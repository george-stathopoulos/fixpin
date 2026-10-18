# Developers

FixPin is two repositories:

- [fixpin](https://github.com/george-stathopoulos/fixpin): the app (`pwa/`), the Cloudflare Worker (`worker/`) and this website (`website/`).
- [fixpin-extension](https://github.com/george-stathopoulos/fixpin-extension): the browser extension.

## The API

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/reports` | Create a report. Returns `id`, `ownerToken`, `expiresAt`. |
| `GET` | `/api/reports/:id` | Read a report. Send the `X-Passcode` header if it has one. |
| `DELETE` | `/api/reports/:id` | Delete early. Needs the `X-Owner-Token` header. |

A report is JSON: `url`, `title`, `note`, `ua`, `viewport` (`w`, `h`, `dpr`), `spots` (`x`, `y`, `w`, `h` as fractions 0 to 1 of the screenshot, plus `selector` and `note`), `errors` (`type`, `msg`), `screenshot` (a PNG, JPEG or WebP data URL), `days` (1, 7 or 30) and an optional `passcode`.

The server keeps only the fields it knows, at sane sizes, and only accepts images as screenshots. CORS is open, so any tool can create reports.

## Storage

Cloudflare KV with a time-to-live equal to the expiry, so deletion needs no job. The owner token and passcode are stored only as SHA-256 hashes.

## Develop

```bash
npm install
npm test
npm run dev
```
