# wordpress-multi-step-form

WordPress plugin with a **Multi Step Form** Gutenberg block — configurable multi-step forms with pricing, conditional steps, and email notifications.

## Local setup

```bash
chmod +x scripts/link-custom-multi-step-form-local.sh
./scripts/link-custom-multi-step-form-local.sh link
```

Then in WordPress:

1. **Plugins** → activate **Custom Multi Step Form** (A.Pēda, v0.8.0)
2. **Multi Step Forms → Form Settings** — set default owner email
3. **Multi Step Forms → Add New** — add steps and publish the form
4. Edit a page → **+** → **Multi Step Form** → choose the form in the block sidebar
5. **Multi Step Forms → Submissions** — view entries after visitors submit

### Email (WP Mail SMTP)

Submissions use WordPress `wp_mail()`. If **WP Mail SMTP** is installed and set up (e.g. Gmail), owner and customer emails use that configuration automatically.

### Form builder tips

- Use answer type **Phone** or **Email** for contact fields, or set **Text validation** on text fields (None / Email / Phone).
- Add a **GDPR consent** step when collecting personal data.
- Use block **Appearance** settings (accent color, radius, max width) before adding custom CSS.

## Production deploy

Build a zip from the repo root:

```bash
chmod +x scripts/build-custom-multi-step-form-zip.sh
./scripts/build-custom-multi-step-form-zip.sh
```

This creates `custom-multi-step-form.zip` in the repo root. Upload it in **Plugins → Add New → Upload Plugin**, activate, then:

1. **Form Settings** — default owner email
2. Configure each form (owner email, success message, steps)
3. Add the block to pages and test submit + email delivery
4. Hard-refresh the front end after updates (assets use filemtime versioning)

Optional custom output path:

```bash
./scripts/build-custom-multi-step-form-zip.sh /tmp/custom-multi-step-form.zip
```

## Docs

- [PLAN.md](PLAN.md) — product and technical plan
- [HANDOFF.md](HANDOFF.md) — current state for agents / handoff
