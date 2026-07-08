import pg from 'pg';

const { Pool } = pg;

/**
 * Server-side database client (Person 2 — Backend).
 *
 * MIGRATION NOTE: this used to be a Supabase (@supabase/supabase-js) client that
 * talked to PostgREST. It is now a thin, Supabase-compatible query builder over
 * `pg` (node-postgres) talking straight to Postgres via DATABASE_URL — so it runs
 * against Supabase's Postgres today and against **Google Cloud SQL for Postgres**
 * after cutover with ZERO code changes (just point DATABASE_URL at Cloud SQL).
 *
 * The exported `supabase` object keeps the same surface the ~14 API routes use:
 *   supabase.from(table).select(cols).eq(col,val)...            -> { data, error }
 *   supabase.from(table).insert(row).select().single()          -> { data, error }
 *   supabase.from(table).update(patch).eq(...)                  -> { data, error }
 *   supabase.from(table).upsert(rows, { onConflict, ignoreDuplicates })
 *   supabase.rpc('match_submissions', { ... })                  -> { data, error }
 * The three Postgres functions (match_submissions/pgvector, convert_proactive_alert,
 * increment_active_cases) travel with the schema to Cloud SQL and are invoked here.
 *
 * `isSupabaseConfigured` name is kept so existing imports don't change.
 */

const connectionString = process.env.DATABASE_URL;

export const isSupabaseConfigured = Boolean(connectionString);

// --- connection pool (lazy) -------------------------------------------------
let _pool = null;
function getPool() {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set: the database client is not configured. ' +
        'Set DATABASE_URL (Supabase Postgres or Cloud SQL) in your environment. See .env.example.'
    );
  }
  if (!_pool) {
    // Pool size per *process*. On serverless (Vercel) every warm function
    // instance owns its own pool, so a large `max` × many concurrent instances
    // exhausts Postgres. Keep it small there (and point DATABASE_URL at a
    // transaction pooler — Supabase :6543 / PgBouncer). A long-lived container
    // (Cloud Run) can afford more; override with PG_POOL_MAX.
    const poolMax = Number(process.env.PG_POOL_MAX) || 3;
    _pool = new Pool({
      connectionString,
      ssl: sslConfig(connectionString),
      max: poolMax,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    // Never let a background idle-client error crash the server process.
    _pool.on('error', (err) => console.error('[db] idle client error:', err.message));
  }
  return _pool;
}

// Supabase's pooler and Cloud SQL public IP require SSL (with a cert not in the
// default CA bundle); local Postgres and sslmode=disable do not.
function sslConfig(cs) {
  if (/sslmode=disable/i.test(cs)) return false;
  if (/@(localhost|127\.0\.0\.1)/i.test(cs)) return false;
  return { rejectUnauthorized: false };
}

// --- PostgREST embedded-relation registry -----------------------------------
// Maps parentTable -> embedAlias -> how to join. Keyed by the alias used in the
// .select() embed (e.g. 'department:departments(*)' -> alias 'department').
const RELATIONSHIPS = {
  cases: {
    department: { table: 'departments', localKey: 'department_id', refKey: 'id' },
  },
  submissions: {
    enriched_submissions: { table: 'enriched_submissions', localKey: 'id', refKey: 'id' },
  },
};

// --- value serialization ----------------------------------------------------
// All list/object columns in this schema are JSONB (there are no text[] columns),
// so objects/arrays are JSON-encoded. embeddings.vector is pgvector, encoded as a
// bracketed literal. Postgres coerces the unknown-typed param to the column type.
function serializeValue(table, col, val) {
  if (val === undefined) return null;
  if (table === 'embeddings' && col === 'vector') return toVectorLiteral(val);
  if (val !== null && typeof val === 'object') return JSON.stringify(val);
  return val;
}
function toVectorLiteral(v) {
  return Array.isArray(v) ? `[${v.join(',')}]` : v;
}

// --- select-string parser (base cols + embedded relations) ------------------
function splitTopLevel(str) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function parseSelect(sel) {
  const base = [];
  const embeds = [];
  for (const seg of splitTopLevel(sel || '*')) {
    const s = seg.trim();
    if (!s) continue;
    const open = s.indexOf('(');
    if (open === -1) {
      base.push(s);
      continue;
    }
    const head = s.slice(0, open).trim();
    const cols = s.slice(open + 1, s.lastIndexOf(')')).trim();
    const [alias, table] = head.includes(':')
      ? head.split(':').map((x) => x.trim())
      : [head, head];
    embeds.push({ alias, table, cols });
  }
  return { baseColumns: base.length ? base.join(', ') : '*', embeds };
}

function embedSql(parentTable, embed, tableAlias) {
  const rel = (RELATIONSHIPS[parentTable] || {})[embed.alias];
  if (!rel) {
    throw new Error(
      `No embedded-relation mapping for ${parentTable} -> "${embed.alias}". Add it to RELATIONSHIPS in utils/supabase/server.js.`
    );
  }
  const cols = embed.cols && embed.cols !== '*' ? embed.cols : '*';
  // to-one embed: nested JSON object (or null when no match), like PostgREST.
  return (
    `(SELECT row_to_json(_e) FROM (SELECT ${cols} FROM ${rel.table} ` +
    `WHERE ${rel.table}.${rel.refKey} = ${tableAlias}.${rel.localKey}) _e) AS ${embed.alias}`
  );
}

const OPERATORS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE', ilike: 'ILIKE' };

// --- query builder (thenable; executes lazily on await/.then) ---------------
class QueryBuilder {
  constructor(table) {
    this.table = table;
    this._op = 'select';
    this._selectArg = '*';
    this._count = null;
    this._head = false;
    this._filters = [];
    this._orders = [];
    this._limit = null;
    this._single = false;
    this._maybeSingle = false;
    this._payload = null;
    this._onConflict = null;
    this._ignoreDuplicates = false;
    this._returning = false;
  }

  select(arg = '*', opts = {}) {
    if (this._op === 'select') {
      this._selectArg = arg || '*';
      if (opts && opts.count) this._count = opts.count;
      if (opts && opts.head) this._head = true;
    } else {
      // .select() chained after insert/update/upsert/delete => RETURNING
      this._returning = true;
    }
    return this;
  }

  insert(payload) { this._op = 'insert'; this._payload = payload; return this; }
  update(payload) { this._op = 'update'; this._payload = payload; return this; }
  upsert(payload, opts = {}) {
    this._op = 'upsert';
    this._payload = payload;
    this._onConflict = opts.onConflict || null;
    this._ignoreDuplicates = Boolean(opts.ignoreDuplicates);
    return this;
  }
  delete() { this._op = 'delete'; return this; }

  _filter(op, col, val) { this._filters.push({ op, col, val }); return this; }
  eq(c, v) { return this._filter('eq', c, v); }
  neq(c, v) { return this._filter('neq', c, v); }
  gt(c, v) { return this._filter('gt', c, v); }
  gte(c, v) { return this._filter('gte', c, v); }
  lt(c, v) { return this._filter('lt', c, v); }
  lte(c, v) { return this._filter('lte', c, v); }
  like(c, v) { return this._filter('like', c, v); }
  ilike(c, v) { return this._filter('ilike', c, v); }
  in(c, vals) { return this._filter('in', c, vals); }
  is(c, v) { return this._filter('is', c, v); }

  order(col, opts = {}) { this._orders.push({ col, asc: opts.ascending !== false }); return this; }
  limit(n) { this._limit = n; return this; }
  single() { this._single = true; return this; }
  maybeSingle() { this._maybeSingle = true; return this; }

  // thenable — makes `await builder` and Promise.allSettled([builder]) work.
  then(onFulfilled, onRejected) {
    return this._execute().then(onFulfilled, onRejected);
  }
  catch(onRejected) { return this.then(undefined, onRejected); }

  _whereClause(params) {
    if (!this._filters.length) return '';
    const parts = this._filters.map((f) => {
      const col = this._alias ? `${this._alias}.${f.col}` : f.col;
      if (f.op === 'in') {
        params.push(f.val);
        return `${col} = ANY($${params.length})`;
      }
      if (f.op === 'is') {
        return `${col} IS ${f.val === null ? 'NULL' : f.val}`;
      }
      params.push(f.val);
      return `${col} ${OPERATORS[f.op]} $${params.length}`;
    });
    return ' WHERE ' + parts.join(' AND ');
  }

  async _execute() {
    try {
      const { text, params } = this._build();
      const res = await getPool().query(text, params);
      return this._shape(res);
    } catch (err) {
      return { data: null, error: normalizeError(err), count: null };
    }
  }

  _build() {
    switch (this._op) {
      case 'select': return this._buildSelect();
      case 'insert': return this._buildInsert();
      case 'update': return this._buildUpdate();
      case 'upsert': return this._buildUpsert();
      case 'delete': return this._buildDelete();
      default: throw new Error(`Unsupported op: ${this._op}`);
    }
  }

  _buildSelect() {
    const params = [];
    const { baseColumns, embeds } = parseSelect(this._selectArg);
    this._alias = embeds.length ? 't' : null;
    const a = this._alias;

    if (this._head && this._count) {
      const where = this._whereClause(params);
      return { text: `SELECT count(*)::int AS count FROM ${this.table}${a ? ` ${a}` : ''}${where}`, params };
    }

    const cols = [];
    cols.push(baseColumns === '*' ? (a ? `${a}.*` : '*') : baseColumns);
    for (const e of embeds) cols.push(embedSql(this.table, e, a));

    let text = `SELECT ${cols.join(', ')} FROM ${this.table}${a ? ` ${a}` : ''}`;
    text += this._whereClause(params);
    if (this._orders.length) {
      text += ' ORDER BY ' + this._orders
        .map((o) => `${a ? `${a}.` : ''}${o.col} ${o.asc ? 'ASC' : 'DESC'}`)
        .join(', ');
    }
    if (this._limit != null) text += ` LIMIT ${Number(this._limit)}`;
    return { text, params };
  }

  _rows() {
    return Array.isArray(this._payload) ? this._payload : [this._payload];
  }

  _buildInsert() {
    const rows = this._rows();
    const cols = Object.keys(rows[0]);
    const params = [];
    const valuesSql = rows
      .map((row) => '(' + cols.map((c) => {
        params.push(serializeValue(this.table, c, row[c]));
        return placeholder(this.table, c, params.length);
      }).join(', ') + ')')
      .join(', ');
    let text = `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES ${valuesSql}`;
    if (this._returning || this._single || this._maybeSingle) text += ' RETURNING *';
    return { text, params };
  }

  _buildUpsert() {
    const rows = this._rows();
    const cols = Object.keys(rows[0]);
    const params = [];
    const valuesSql = rows
      .map((row) => '(' + cols.map((c) => {
        params.push(serializeValue(this.table, c, row[c]));
        return placeholder(this.table, c, params.length);
      }).join(', ') + ')')
      .join(', ');
    let text = `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES ${valuesSql}`;
    const conflict = this._onConflict || cols[0];
    if (this._ignoreDuplicates) {
      text += ` ON CONFLICT (${conflict}) DO NOTHING`;
    } else {
      const updates = cols
        .filter((c) => c !== conflict)
        .map((c) => `${c} = EXCLUDED.${c}`)
        .join(', ');
      text += updates
        ? ` ON CONFLICT (${conflict}) DO UPDATE SET ${updates}`
        : ` ON CONFLICT (${conflict}) DO NOTHING`;
    }
    if (this._returning || this._single || this._maybeSingle) text += ' RETURNING *';
    return { text, params };
  }

  _buildUpdate() {
    const params = [];
    const cols = Object.keys(this._payload);
    const setSql = cols.map((c) => {
      params.push(serializeValue(this.table, c, this._payload[c]));
      return `${c} = ${placeholder(this.table, c, params.length)}`;
    }).join(', ');
    let text = `UPDATE ${this.table} SET ${setSql}`;
    this._alias = null;
    text += this._whereClause(params);
    if (this._returning || this._single || this._maybeSingle) text += ' RETURNING *';
    return { text, params };
  }

  _buildDelete() {
    const params = [];
    this._alias = null;
    let text = `DELETE FROM ${this.table}`;
    text += this._whereClause(params);
    if (this._returning || this._single || this._maybeSingle) text += ' RETURNING *';
    return { text, params };
  }

  _shape(res) {
    if (this._head && this._count) {
      return { data: null, error: null, count: res.rows[0] ? res.rows[0].count : 0 };
    }
    const rows = res.rows || [];
    if (this._single) {
      if (rows.length !== 1) {
        return {
          data: null,
          count: null,
          error: { code: 'PGRST116', message: 'JSON object requested, but 0 or multiple rows returned' },
        };
      }
      return { data: rows[0], error: null, count: null };
    }
    if (this._maybeSingle) {
      if (rows.length > 1) {
        return {
          data: null,
          count: null,
          error: { code: 'PGRST116', message: 'JSON object requested, but multiple rows returned' },
        };
      }
      return { data: rows[0] ?? null, error: null, count: null };
    }
    return { data: rows, error: null, count: this._count ? rows.length : null };
  }
}

// vector column needs an explicit ::vector cast on its placeholder.
function placeholder(table, col, idx) {
  if (table === 'embeddings' && col === 'vector') return `$${idx}::vector`;
  return `$${idx}`;
}

function normalizeError(err) {
  return { message: err.message, code: err.code, details: err.detail || null };
}

// --- RPC (Postgres function invocation) -------------------------------------
class RpcBuilder {
  constructor(fn, params) {
    this.fn = fn;
    this.params = params || {};
  }
  then(onFulfilled, onRejected) {
    return this._execute().then(onFulfilled, onRejected);
  }
  catch(onRejected) { return this.then(undefined, onRejected); }

  async _execute() {
    try {
      const keys = Object.keys(this.params);
      const values = [];
      const argSql = keys.map((k, i) => {
        const v = this.params[k];
        // numeric arrays are pgvector args (e.g. match_submissions.query_embedding)
        if (Array.isArray(v) && v.every((n) => typeof n === 'number')) {
          values.push(toVectorLiteral(v));
          return `${k} => $${values.length}::vector`;
        }
        values.push(v !== null && typeof v === 'object' ? JSON.stringify(v) : v);
        return `${k} => $${values.length}`;
      });
      const text = `SELECT * FROM ${this.fn}(${argSql.join(', ')})`;
      const res = await getPool().query(text, values);
      const rows = res.rows || [];
      // Scalar-returning function (e.g. RETURNS boolean) comes back as one row
      // with a single column named after the function -> unwrap to that value,
      // matching how supabase-js surfaces scalar RPC results.
      if (rows.length === 1) {
        const cols = Object.keys(rows[0]);
        if (cols.length === 1 && cols[0] === this.fn) {
          return { data: rows[0][this.fn], error: null };
        }
      }
      return { data: rows, error: null };
    } catch (err) {
      return { data: null, error: normalizeError(err) };
    }
  }
}

// Storage moved to Google Cloud Storage — see lib/server/media.js. Nothing calls
// supabase.storage anymore; this stub makes any lingering use fail loudly.
const storageStub = {
  from() {
    throw new Error('supabase.storage was removed in the Cloud migration. Use lib/server/media.js (Google Cloud Storage).');
  },
};

export const supabase = {
  from(table) { return new QueryBuilder(table); },
  rpc(fn, params) { return new RpcBuilder(fn, params); },
  storage: storageStub,
};
