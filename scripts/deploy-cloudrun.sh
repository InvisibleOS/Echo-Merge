#!/usr/bin/env bash
#
# Deploy the People's Priorities Next.js app to Google Cloud Run.
#
#   One-time (interactive):  gcloud auth login && gcloud config set project <ID>
#   Then:                    ./scripts/deploy-cloudrun.sh setup     # APIs, repo, secrets
#                            ./scripts/deploy-cloudrun.sh deploy    # build + deploy
#
# Config comes from env vars (all optional except where noted):
#   PROJECT_ID            GCP project (defaults to `gcloud config get-value project`)
#   REGION                Cloud Run region            (default: us-central1)
#   SERVICE               Cloud Run service name      (default: peoples-priorities)
#   REPO                  Artifact Registry repo      (default: apps)
#   CLOUD_SQL_INSTANCE    "project:region:instance" — connects Cloud Run to Cloud SQL
#                         over the built-in socket (recommended). See DB note below.
#   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY   browser Maps key — REQUIRED for `deploy`
#   NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID    optional
#
# DB NOTE: when CLOUD_SQL_INSTANCE is set, the DATABASE_URL secret must use the
# Cloud SQL socket form (SSL not needed over the local socket):
#   postgresql://USER:PASS@/DBNAME?host=/cloudsql/PROJECT:REGION:INSTANCE&sslmode=disable
# The `sslmode=disable` is honored by utils/supabase/server.js's sslConfig().
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-peoples-priorities}"
REPO="${REPO:-apps}"
CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-}"
MAPS_KEY="${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:-}"
MAP_ID="${NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID:-}"

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:latest"

# Server-side secrets (Secret Manager -> Cloud Run env). NEVER baked into the image.
SECRETS="DATABASE_URL=DATABASE_URL:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,GOOGLE_API_KEY=GOOGLE_API_KEY:latest,GOOGLE_MAPS_API_KEY=GOOGLE_MAPS_API_KEY:latest,TAVILY_API_KEY=TAVILY_API_KEY:latest"
RUNTIME_ENV="GEMINI_MODEL=gemini-2.5-flash,GEMINI_EMBEDDING_MODEL=gemini-embedding-001,NEXT_PUBLIC_USE_MOCK_DATA=false"

require() { [ -n "${!1:-}" ] || { echo "❌ $1 is required (see header)"; exit 1; }; }

cmd_setup() {
  require PROJECT_ID
  echo "▶ Enabling required APIs…"
  gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
    cloudbuild.googleapis.com secretmanager.googleapis.com sqladmin.googleapis.com \
    --project "$PROJECT_ID"

  echo "▶ Creating Artifact Registry repo '$REPO' (ok if it already exists)…"
  gcloud artifacts repositories create "$REPO" --repository-format=docker \
    --location="$REGION" --project "$PROJECT_ID" 2>/dev/null || true

  echo "▶ Pushing secrets from .env.local → Secret Manager…"
  for k in DATABASE_URL GEMINI_API_KEY GOOGLE_API_KEY GOOGLE_MAPS_API_KEY TAVILY_API_KEY; do
    v=$(grep -E "^$k=" .env.local 2>/dev/null | head -1 | cut -d= -f2- || true)
    [ -n "$v" ] || { echo "  ⚠ $k missing in .env.local — skipping (add it manually)"; continue; }
    if printf '%s' "$v" | gcloud secrets create "$k" --data-file=- --project "$PROJECT_ID" 2>/dev/null; then
      echo "  + created $k"
    else
      printf '%s' "$v" | gcloud secrets versions add "$k" --data-file=- --project "$PROJECT_ID" >/dev/null
      echo "  ↻ added new version of $k"
    fi
  done
  echo "✔ setup complete."
  echo "  Reminder: if CLOUD_SQL_INSTANCE is used, update the DATABASE_URL secret to the socket form (see header)."
}

cmd_deploy() {
  require PROJECT_ID
  require MAPS_KEY
  echo "▶ Building image via Cloud Build → $IMAGE"
  gcloud builds submit --config cloudbuild.yaml \
    --substitutions="_REGION=${REGION},_REPO=${REPO},_SERVICE=${SERVICE},_MAPS_KEY=${MAPS_KEY},_MAP_ID=${MAP_ID}" \
    --project "$PROJECT_ID" .

  echo "▶ Deploying to Cloud Run…"
  sqlflag=()
  [ -n "$CLOUD_SQL_INSTANCE" ] && sqlflag=(--add-cloudsql-instances "$CLOUD_SQL_INSTANCE")
  gcloud run deploy "$SERVICE" \
    --image "$IMAGE" --region "$REGION" --platform managed \
    --allow-unauthenticated --port 8080 --min-instances 1 --cpu-boost \
    --set-secrets "$SECRETS" --set-env-vars "$RUNTIME_ENV" \
    "${sqlflag[@]}" --project "$PROJECT_ID"

  echo "✔ deployed:"
  gcloud run services describe "$SERVICE" --region "$REGION" \
    --project "$PROJECT_ID" --format='value(status.url)'
}

case "${1:-}" in
  setup)  cmd_setup ;;
  deploy) cmd_deploy ;;
  *) echo "usage: $0 {setup|deploy}"; exit 1 ;;
esac
