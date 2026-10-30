# ShortStack (working codename)

Short-video app v1: installable web app (PWA). Vite + React + TypeScript, Supabase (auth, Postgres with RLS, Storage, one Edge Function for sign-up), hosted on GitHub Pages.

- **Rename the app:** edit `src/brand.ts` only (name, tagline, logo text, colors). Page title and install manifest are generated from it.
- **Rules:** `src/rules.ts`. **Schema:** `supabase/migrations/`. **Sign-up function:** `supabase/functions/signup/`.
- **Make an account admin:** `update public.profiles set is_admin = true where username = '...';`
- **Tests:** `npm run build && npx playwright test` (needs a git-ignored `.env.test` with seeded account passwords). `BASE_URL=https://... npx playwright test` runs against the live site.
- Demo clips are ffmpeg test patterns (`seed/`), marked DEMO.
- Shop/tips are placeholders only. No payments are wired.
