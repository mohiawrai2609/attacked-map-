Deploy folder for the GUARD daily dashboard ("Daily Incident Brief").

LIVE:    https://attacked-daily-brief.vercel.app   (Vercel project: attacked-daily-brief)
LINKED:  the daily email (Supabase edge function incident-deliver) builds its
         "View Live Dashboard" button as  <LIVE>?sweep_id=<id>

Do NOT deploy the ATTACKEDMAP folder itself -- its index.html is the Global Attack
Map app. This folder holds only the dashboard, served as index.html.

After editing ../dashboard.html, re-copy it here, then deploy from THIS folder:

  cp ../dashboard.html index.html
  vercel deploy --prod --yes

README.txt is kept off the live site by .vercelignore.

History: until 2026-09-17 the dashboard lived at sensational-ganache-31f0d0.netlify.app,
a Netlify site not found in the owner's Netlify account, so it could never be updated.
Emails sent before 2026-09-17 still link there and show the older build.
