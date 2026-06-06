# wordpress-multi-step-form

WordPress plugin with a **Multi Step Form** Gutenberg block — a configurable multi-step form for many different needs.

## Local setup

```bash
chmod +x scripts/link-custom-multi-step-form-local.sh
./scripts/link-custom-multi-step-form-local.sh link
```

Then in WordPress:

1. **Plugins** → activate **Custom Multi Step Form** (A.Pēda, v0.7.0)
2. **Multi Step Forms → Form Settings** — set default owner email
3. **Multi Step Forms → Add New** — add steps and publish the form
4. Edit a page → **+** → **Multi Step Form** → choose the form in the block sidebar
5. **Multi Step Forms → Submissions** — view entries after visitors submit

### Email (WP Mail SMTP)

Submissions use WordPress `wp_mail()`. If **WP Mail SMTP** is installed and set up (e.g. Gmail), all owner and customer emails use that configuration automatically — no extra SMTP settings in this plugin.

See [PLAN.md](PLAN.md) and [HANDOFF.md](HANDOFF.md) for full roadmap.
