# Person 1 (Frontend) — Complete Setup Guide

You own **two surfaces** in one Next.js app:
1. **Citizen Submission App** (`/submit`) — text/voice/photo intake, language selector, Indian-script rendering
2. **MP Dashboard** (`/dashboard`) — ranked priority list, hotspot heatmap (Mapbox), drill-down with original + translated evidence

You also own **frontend hosting** and the **final deployed prototype link** — the single most important deliverable in this hackathon (it's literally what a judge clicks).

This guide assumes **VS Code + Next.js 14 (App Router) + TypeScript + Tailwind CSS + Mapbox GL JS**.

---

## 0. Prerequisites (install once, on your machine)

Check what you have first:
```bash
node --version   # need 18.17+ or 20+
npm --version    # comes with node
git --version
```

If Node is missing or too old, install from https://nodejs.org (LTS version).

**VS Code Extensions to install** (Extensions icon → search → Install):
- `ES7+ React/Redux/React-Native snippets`
- `Tailwind CSS IntelliSense`
- `Prettier - Code formatter`
- `ESLint`

---

## 1. Create the Project (Day 1, first hour)

```bash
# From your team's repo root (after Person 2 creates the GitHub repo)
npx create-next-app@latest frontend

# When prompted, answer:
# ✔ TypeScript?                 Yes
# ✔ ESLint?                     Yes
# ✔ Tailwind CSS?               Yes
# ✔ `src/` directory?           No
# ✔ App Router?                 Yes
# ✔ Import alias (@/*)?         Yes

cd frontend
npm run dev
```

Open `http://localhost:3000` — you should see the default Next.js page. This confirms your environment works.

**Now replace the scaffolded files with the ones in this package** (copy every file from this guide into the matching path in your `frontend/` folder — the folder tree below tells you exactly where each one goes).

---

## 2. Install Additional Packages

```bash
# Mapbox for the hotspot heatmap
npm install mapbox-gl
npm install --save-dev @types/mapbox-gl

# Icons
npm install lucide-react

# Utility for merging Tailwind classes cleanly
npm install clsx tailwind-merge

# Fonts with full Indic script coverage — installed via next/font, no npm package needed
```

That's it — this stack is intentionally light. Don't add a UI kit (shadcn, MUI, etc.) unless you have spare time; Tailwind + hand-built components is faster to control for a demo.

---

## 3. Get Your Mapbox Token (5 minutes)

1. Go to **https://account.mapbox.com/auth/signup/** → sign up free
2. Dashboard → copy your **Default public token** (starts with `pk.`)
3. You'll paste this into `.env.local` in step 5

The roadmap mentions Google Maps Platform as an alternative — **use Mapbox**. It's faster to set up with no billing account required for the free tier, and `mapbox-gl` has better out-of-the-box heatmap layer support (`heatmap` layer type built in), which is exactly what `/hotspots` needs.

---

## 4. Your Folder Structure (target state)

```
frontend/
├── .env.local                          # secrets — never commit
├── .env.local.example                  # committed template
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── app/
│   ├── layout.tsx                      # root layout, loads fonts
│   ├── globals.css                     # Tailwind + design tokens
│   ├── page.tsx                        # landing → routes to /submit
│   │
│   ├── submit/
│   │   └── page.tsx                    # CITIZEN SUBMISSION APP
│   │
│   └── dashboard/
│       └── page.tsx                    # MP DASHBOARD
│
├── components/
│   ├── submission/
│   │   ├── SubmissionForm.tsx          # orchestrates the whole intake flow
│   │   ├── LanguageSelector.tsx        # dropdown, 3+ Indian languages
│   │   ├── TextInput.tsx               # multi-script textarea
│   │   ├── VoiceRecorder.tsx           # MediaRecorder API wrapper
│   │   ├── PhotoUpload.tsx             # file input + camera capture
│   │   └── SubmissionSuccess.tsx       # confirmation state
│   │
│   ├── dashboard/
│   │   ├── DashboardShell.tsx          # layout: list + map side by side
│   │   ├── PriorityList.tsx            # ranked list of PriorityItems
│   │   ├── PriorityCard.tsx            # single row in the list
│   │   ├── HotspotMap.tsx              # Mapbox heatmap component
│   │   └── DrillDownPanel.tsx          # original + translated evidence
│   │
│   └── ui/
│       ├── Button.tsx
│       ├── Badge.tsx                   # urgency/category chips
│       └── LoadingSpinner.tsx
│
├── lib/
│   ├── types.ts                        # THE CONTRACT — matches /docs/contracts.md exactly
│   ├── api.ts                          # all fetch calls to Person 2's backend
│   ├── mockData.ts                     # fake data so you're never blocked
│   └── languages.ts                    # language list + BCP-47 codes
│
└── public/
    └── (icons, favicon)
```

---

## 5. Environment Variables

Create `.env.local` in `frontend/`:

```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_token_here
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_USE_MOCK_DATA=true
```

- `NEXT_PUBLIC_API_BASE_URL` → **ask Person 2** for their local dev URL (Day 1) and their deployed Cloud Run URL (Day 3+)
- `NEXT_PUBLIC_USE_MOCK_DATA=true` → flip to `false` once Person 2's real endpoints are live (Day 3). This one flag is what lets you build Day 1–2 without being blocked.

Also create `.env.local.example` (same file, no real token) and commit that one — never commit `.env.local` itself. Add `.env.local` to `.gitignore` (Next.js does this by default).

---

## 6. What to Ask Your Teammates For

| From | What | When |
|---|---|---|
| **Person 2 (Backend)** | Local dev API base URL (`http://localhost:PORT`) | Day 1 |
| **Person 2** | Deployed Cloud Run URL | Day 3 |
| **Person 2** | Confirmation that `/submit`, `/submissions`, `/priorities`, `/hotspots` match `lib/types.ts` exactly — flag any drift immediately | Day 1 (contract freeze) + Day 3 (wiring) |
| **Person 4 (Data/Logic)** | Sample of 5–10 real `PriorityItem` JSON objects (once scoring v1 exists) so your dashboard renders realistic content, not lorem ipsum | Day 2–3 |
| **Person 3 (AI/Ingestion)** | Confirm the exact language codes/labels they support (so your `LanguageSelector` list matches what Speech-to-Text V2 + Gemini actually handle) | Day 1 |
| **All** | The chosen demo constituency name + the 3+ demo languages — hardcode these into your placeholder text/copy | Day 1 |

**Nobody blocks you before Day 3.** Everything below runs entirely on mock data until then.

---

## 7. Day-by-Day for You Specifically

- **Day 1:** Scaffold both pages, mock API wired, map renders with dummy markers, deploy a placeholder to Vercel.
- **Day 2:** Real voice recording + photo upload + language selector working. Dashboard reads full mock `PriorityItem[]` list + heatmap with mock hotspots.
- **Day 3:** Flip `NEXT_PUBLIC_USE_MOCK_DATA=false`. Wire to Person 2's real live endpoints. First true end-to-end submission appears on your dashboard.
- **Day 4:** Polish both surfaces, confirm Indic scripts render correctly, redeploy to a stable URL, add basic auth gate on `/dashboard`.
- **Day 5:** Cross-device/browser bug bash, error/loading states, low-connectivity resilience.
- **Day 6:** Final production deploy from `main`, write the demo path doc for the video team.
- **Day 7:** Final smoke test from a clean device/network before noon.

---

## 8. Deployment (Vercel — fastest option)

```bash
npm install -g vercel
vercel login
vercel          # first deploy — follow prompts, link to your GitHub repo
```

After the first deploy, every push to `main` auto-deploys. Set your env vars in the Vercel dashboard (Project → Settings → Environment Variables) — mirror everything from `.env.local`.

This gives you a stable URL like `https://your-project.vercel.app` on Day 1 — that placeholder URL **is** your deployed prototype link; you just keep improving what's behind it all week.

---

## 9. Run Everything Locally

```bash
cd frontend
npm run dev
```

- Citizen app: `http://localhost:3000/submit`
- MP dashboard: `http://localhost:3000/dashboard`

Keep this running in one VS Code terminal (`Ctrl+``) while you edit — Next.js hot-reloads on save.
