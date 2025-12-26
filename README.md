AXIS BLUE — Field Ops (Cloudflare Pages + Supabase)

Deploy:
- GitHub main triggers Cloudflare Pages deploy.
- Cloudflare Pages env vars required:
  - SUPABASE_URL
  - SUPABASE_ANON_KEY

Supabase:
- Run schema.sql in Supabase SQL editor
- Create a user in Supabase Auth (email/password)

iOS NFC fallback:
- Use iOS Shortcut to open:
  https://aptest.axisblue.io/?nfc=<payload>
The Capture tab will auto-fill NFC payload.
