# av.by → USD (NBRB rate)

A Chromium extension (Manifest V3) that rewrites on-page prices from Belarusian rubles (BYN) to an **approximate USD** value using the **official USD rate of the National Bank of the Republic of Belarus** via the [NBRB API](https://api.nbrb.by/exrates/rates/USD?parammode=2).

It runs on all `https://*.av.by` subdomains (cars, motorcycles, parts, and other sections).

**Rate / offline behavior:** The service worker keeps a **cached** rate in `chrome.storage` for up to **6 hours**. If the cache is stale, it **must** refetch the NBRB API; if that request **fails** (after a request timeout, invalid HTTP, or network error), the extension does **not** convert prices and leaves the **original BYN** text on the page (no substitute using an old rate). Failed background fetches are logged to the console with `console.debug` under the tag `[av-by-usd]`.

**Conversion rules:** `src/rate.js` only rewrites whole ruble amounts at or above a minimum threshold (`MIN_BYN`, at least 1). Sub-threshold or ambiguous fragments are left unchanged. USD display uses a tilde and rounds **up** to a whole dollar (`~$…`). BYN numbers may use a comma or a dot for decimals; grouped thousands with spaces or with dots (e.g. `1.234,50`) are supported so values like `2.29` are not split into a bare `2` and a spurious `29 р` match.

## Install (unpacked, developer mode)

1. Clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the **repository root** (the folder that contains `manifest.json`).

## Development

Node.js **18+** (for the linter and formatter).

```bash
npm install
npm run lint
npm test
npm run format:check
npm run format
```

On **push** and **pull requests** to `main` / `master`, [GitHub Actions](.github/workflows/ci.yml) runs `npm ci`, **ESLint**, **Prettier** (`format:check`), and **`npm test`**.

### Layout

| Path                               | Role                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `manifest.json`                    | MV3, permissions, service worker, content scripts                               |
| `src/shared/messages.js`           | Shared message type + JSDoc for `GetRateResponse` (service worker + content)    |
| `src/background/service-worker.js` | NBRB fetch (with timeout), `chrome.storage`, alarms, `onMessage`                |
| `src/rate.js`                      | Parse BYN strings, convert, `~$…` output (USD rounded **up** to a whole dollar) |
| `src/content/index.js`             | DOM: `*price*` class blocks, common text attributes, text-node walk             |
| `test/rate.test.mjs`               | `node --test` unit tests for `rate.js` (loaded in a VM)                         |

There is no bundler: scripts are listed in the manifest as separate files.

## License

MIT — see [LICENSE](LICENSE).
