# wordpress-multi-step-form

WordPress plugin with a **Multi Step Form** Gutenberg block — a configurable multi-step form for many different needs.

## Two different plugins on Local

| Plugins screen name        | Author       | Folder                   | Use                                    |
| -------------------------- | ------------ | ------------------------ | -------------------------------------- |
| **Multi Step Form**        | Mondula GmbH | `multi-step-form`        | Third-party — delete or leave inactive |
| **Custom Multi Step Form** | A.Pēda       | `custom-multi-step-form` | **Activate this one**                  |

The block inserter still shows **Multi Step Form** (our block). Only the plugin list name is different so it does not clash with Mondula.

## Local setup

```bash
chmod +x scripts/link-custom-multi-step-form-local.sh
./scripts/link-custom-multi-step-form-local.sh link
```

Then in WordPress:

1. **Plugins** → activate **Custom Multi Step Form** (A.Pēda, v0.3.0)
2. Optional: delete **Multi Step Form** by Mondula if you do not need it
3. Edit a page → **+** → search **Multi Step Form**
