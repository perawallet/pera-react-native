# Pera links

The format of the links Pera opens, for anyone who generates them: backend banners and push
notifications, Pera Web, and QR codes. The parser lives in `packages/deeplinks`; the app's dispatch is
`apps/mobile/src/modules/deeplink/hooks/useDeepLink.ts`.

## Forms

| Form                | Shape                                                      |
| ------------------- | ---------------------------------------------------------- |
| App link            | `perawallet://app/<path>?<params>`                         |
| Universal app link  | `https://perawallet.app/qr/perawallet/app/<path>?<params>` |
| Legacy address link | `perawallet://<ADDRESS>?<params>`                          |

The universal form is the app link behind a fixed prefix and parses identically.

Chain URIs (`algorand://`, `ethereum:`, `wc:`) are not Pera links. Each chain package parses its own;
see `packages/deeplinks/src/chain-adapter.ts`.

## Choosing the chain: `chain=`

An app link names its chain with an optional `chain=<CAIP-2>` param:

| Value                                       | Target               |
| ------------------------------------------- | -------------------- |
| absent                                      | Algorand, no network |
| `algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k` | Algorand MainNet     |
| `algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDe` | Algorand TestNet     |
| `eip155:1`                                  | Ethereum mainnet     |

- **Absent means Algorand.** Every link issued before the param existed is an Algorand link, so the
  default can never change. Leave `chain` off Algorand links rather than spelling out MainNet: a link
  that names a network is refused while the app is on another one (TestNet link, MainNet app), and
  one that names none runs on whichever network the user has selected.
- **Unknown values fail loudly.** A CAIP-2 the build has no chain for, an empty `chain=`, or a chain
  switched off by remote config shows the network-unavailable error. The link never falls back to
  Algorand.
- **Addresses and asset ids are read in the target chain's terms.** An address is validated with
  that chain's codec, so `add-contact?address=0x…` without `chain` is rejected as an invalid Algorand
  address. An asset id is the chain's own spelling: a numeric ASA id on Algorand, a token contract
  address on Ethereum.

A link is only as good as the build that opens it: a chain this build can't route yet is refused
with the same network-unavailable error.

## Paths

`chain` applies to the paths marked ✓. The others are Algorand-only or chain-agnostic and ignore it,
so a `chain=` on them changes nothing.

| Path                                                                                            | Params                                                                                                                                   | `chain`  |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `add-contact`, `edit-contact`                                                                   | `address`, `label?`                                                                                                                      | ✓        |
| `register-watch-account` (also `add-watch-account`)                                             | `address`, `label?`                                                                                                                      | ✓        |
| `receiver-account-selection`                                                                    | `address`                                                                                                                                | ✓        |
| `address-actions`                                                                               | `address`, `label?`                                                                                                                      | ✓        |
| `account-detail`                                                                                | `address`                                                                                                                                | ✓        |
| `asset-transfer`                                                                                | `receiverAddress`, `assetId?` (absent: native asset), `amount?`, `note?`, `label?`, `xnote?` (Algorand)                                  | ✓        |
| `asset-opt-in`                                                                                  | `assetId`, `address?`                                                                                                                    | ✓        |
| `asset-detail`                                                                                  | `address`, `assetId`                                                                                                                     | ✓        |
| `swap`                                                                                          | `address?`, `assetInId?`, `assetOutId?`                                                                                                  | ✓        |
| `buy`, `sell`                                                                                   | `address?`                                                                                                                               | ✓        |
| `keyreg`                                                                                        | `senderAddress`, `type?` (`online`/`offline`), `votekey`, `selkey`, `sprfkey`, `votefst`, `votelst`, `votekd`, `fee?`, `note?`, `xnote?` | Algorand |
| `asset-inbox`                                                                                   | `address`                                                                                                                                | Algorand |
| `shared-account-import` (also `joint-account-import`)                                           | `address`                                                                                                                                | Algorand |
| `sign-request` (also `shared-account-sign-request`, `joint-account-sign-request`)               | `signRequestId`                                                                                                                          | Algorand |
| `wallet-connect`                                                                                | `uri` (or `walletConnectUrl`)                                                                                                            | —        |
| `web-import`                                                                                    | Pera Web backup handoff                                                                                                                  | —        |
| `recover-address`                                                                               | `mnemonic`                                                                                                                               | —        |
| `discover-browser`, `internal-browser`                                                          | `url`                                                                                                                                    | —        |
| `discover` (also `discover-path`), `cards` (also `cards-path`), `staking` (also `staking-path`) | `path?`                                                                                                                                  | —        |
| no path                                                                                         | —                                                                                                                                        | —        |

Encoding rules:

- `amount` and `fee` are integers in the asset's **base units** (microAlgos for ALGO, wei for ETH),
  never display units.
- `url` and `uri` may be base64. A value made only of base64 characters is always decoded, so encode
  the value rather than relying on a plain one being passed through.
- An unknown path, a missing required param, or a value the target chain can't read (a
  non-integer amount, an asset id in another chain's spelling) opens the home screen.

Links that arrive as push notifications or banners are restricted to navigation-only types; see
`packages/deeplinks/src/notification-policy.ts`.

## Legacy address links

`perawallet://<ADDRESS>?amount=…&asset=…&note=…` is the format the native apps issued before app
links. It is Algorand-only, ignores `chain`, and is kept so printed QR codes keep working. Don't issue
new ones; use the app-link paths above.
