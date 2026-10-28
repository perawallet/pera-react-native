# Phishing list sources

The site-safety check reads two community-maintained lists. Both are downloaded straight from
GitHub, and a snapshot of each ships in `src/bundled/phishing-lists.json`. Refresh the snapshot
with `pnpm update:phishing-lists`.

| Source                                                                          | File              | Licence    | Used for                                       |
| ------------------------------------------------------------------------------- | ----------------- | ---------- | ---------------------------------------------- |
| [MetaMask/eth-phishing-detect](https://github.com/MetaMask/eth-phishing-detect) | `src/config.json` | DBAD 1.2   | Blocked domains, allowlist, look-alike targets |
| [polkadot-js/phishing](https://github.com/polkadot-js/phishing)                 | `all.json`        | Apache-2.0 | Blocked domains                                |

The data is used as published; Pera adds no entries to either list. DBAD asks for attribution,
which this file and the source table in `src/sources.ts` give.

Lists under GPL-3.0 (ScamSniffer, PhishFort) are not used: their terms don't fit an Apache-2.0
app that bundles the data.

Two traps:

- Polkadot's `allow` array names hosting platforms (`vercel.app`, `github.io`) as matching hints.
  Read as an allowlist, it would exempt every site hosted on them, so the parser ignores it.
- Entries with a path or wildcard are dropped: a dApp reaches the wallet with an origin only, so
  they could never match.
