import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],

  // Cloud Run: emit a self-contained server bundle (Day 4 deploy).
  output: "standalone",

  // NOTE: no path rewrites. The contract's logical paths (/submit, /priorities,
  // …) are served under /api/*, and the frontend carries the /api in
  // NEXT_PUBLIC_API_BASE_URL (=<origin>/api). We deliberately do NOT rewrite
  // bare /submit -> /api/submit, because app/submit/page.tsx (the citizen form)
  // already owns the /submit route — a rewrite there would either lose to the
  // filesystem page or hijack the page's GET. See docs/contracts.md §2.
};

export default nextConfig;
