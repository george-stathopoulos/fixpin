# FixSpot

**Show support where it breaks.** An installable web app (PWA) and a Cloudflare Worker that turn a screenshot and a few clicks into a private link that expires by itself. No account.

Part of [Fixpass for WordPress](https://george-stathopoulos.github.io/fixpass/) (the WordPress plugin gives support safe, temporary admin access). Also see the [browser extension](https://github.com/george-stathopoulos/fixspot-extension).

- **App** (`pwa/`): add, paste or drop a screenshot, click or drag to mark spots, write a note, pick 1/7/30 days and an optional passcode. Installable, works offline for the shell, and accepts screenshots from the phone's share sheet. Dark mode and keyboard accessible.
- **Report page** (`/r/<id>`): screenshot with numbered spots, details, errors, "Copy details", and "Delete now" on the device that made it.
- **Worker** (`worker/index.js`): `POST /api/reports`, `GET /api/reports/:id`, `DELETE /api/reports/:id`. Stored in KV with automatic expiry. Only hashes of the owner token and passcode are kept.

Docs: [privacy](docs/privacy.md), [deploy your own](docs/deploy.md).

## Develop

```bash
npm install
npm test           # Worker tests (no Cloudflare needed)
npm run dev        # http://127.0.0.1:8787 with local KV
```

## License

GPL-2.0-or-later.
