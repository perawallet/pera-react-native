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

Chain URIs are not Pera links; see [Chain URIs](#chain-uris).

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

## Legacy address links

`perawallet://<ADDRESS>?amount=…&asset=…&note=…` is the format the native apps issued before app
links. It is Algorand-only, ignores `chain`, and is kept so printed QR codes keep working. Don't issue
new ones; use the app-link paths above.

## Chain URIs

Each chain parses its own URI schemes through a `DeeplinkChainAdapter` registered from its chain
package (`packages/chain-*/src/register.ts`):

| Chain    | Schemes                              | Reads                                                                                          |
| -------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Algorand | `algorand:`, `algo:`, `algorand-wc:` | Addresses, payments and asset transfers, opt-ins, key registration, ARC-90 asset and app links |
| Ethereum | `ethereum:`                          | EIP-681: an address, an ether payment, an ERC-20 `transfer`                                    |

`wc:` pairing URIs belong to no chain; `packages/deeplinks/src/wallet-connect.ts` reads them.

A chain URI is resolved in the same terms as a Pera link with `chain=`:

- **Sender.** A payment goes out from the selected account only when it lives on the link's chain.
  Otherwise the wallet's one account on that chain is used, a picker opens when there are several, and
  the no-account error shows when there is none. A link for one chain never sends from another's
  account (`resolveSendAccount` in `apps/mobile/src/modules/transactions`).
- **Network.** A link that names a network (`ethereum:0x…@11155111`, `algorand://net:testnet/…`) is refused
  while that chain is on another one, never switched. One that names none runs on the chain's selected
  network. An `ethereum:` link that names no chain id is Ethereum's (EIP-681 reads it as chain 1), and is
  refused when Ethereum isn't registered rather than paid on another EVM chain.
- **Refusals.** A chain switched off by remote config shows the network-unavailable error. A link the
  chain reads but won't act on shows "Link not supported": an EIP-681 `approve` or any function
  other than `transfer` (an approval from a link is a drain vector, and the wallet decodes no
  calldata), or a capability the chain lacks. Unreadable text is not a link at all.

## Entry points and policies

Every link reaches `useDeepLink` with its source, and what it may do depends on that source:

| Source                      | Policy                                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| OS, QR, paste               | Everything the parser reads. The OS delivers the schemes in `apps/mobile/app.config.builder.js` (iOS `scheme`, Android intent filter).    |
| In-app browser page         | `packages/deeplinks/src/page-initiated-policy.ts`: value-bearing types only from the trusted Discover origin's top frame; others refused. |
| Push notification or banner | `packages/deeplinks/src/notification-policy.ts`: navigation-only types.                                                                   |

On top of the source policy, `packages/deeplinks/src/capability-policy.ts` refuses a link whose
chain capability is off, whatever its source.

- **`ethereum:` from the OS is shared.** On iOS any installed wallet can claim it and the OS picks
  one; Android shows a chooser. Pera's own surfaces issue `perawallet://` with `chain=`, which only
  Pera opens.
- **A page has two ways in.** A navigation goes through `useWebViewNavigationGuard`, which applies the
  page policy per link type. The `openNativeURI` bridge method dispatches any parseable link without
  it, so the bridge's trusted-origin gate (`usePeraWebviewInterface`) is what keeps other origins out.
- **The browser extension registers no schemes.** It reads chain URIs only from its paste field.

## Adding a chain

1. Implement `DeeplinkChainAdapter` (`packages/deeplinks/src/chain-adapter.ts`) in the chain package
   and register it with `deeplinkAdapters`. Two chains claiming one scheme throws at bootstrap.
2. Return `unsupported-action` for anything the wallet understands but refuses to do, so the user is
   told why rather than shown "not a link".
3. A chain whose links carry a `chain-action` intent (Algorand's key registration) also implements
   `buildChainAction`; the adapter contract suite fails without it. The app's
   `useChainActionDeeplink` does the chain-neutral part: the sender must be in the wallet and
   signable on the link's chain, the network must match, and the link is gated by `send`.
4. `chain=` accepts each network's `caip2` from the chain descriptor, so Pera links reach the new
   chain with no parser change. Classify any new `DeeplinkType` in the notification, page and
   capability policy records; each is exhaustive, so an unclassified type fails to compile.
5. To receive the scheme from other apps, add it to `scheme` and the Android intent filter in
   `apps/mobile/app.config.builder.js`, and to the identity checks in
   `apps/mobile/scripts/verify-*-identity.mjs`.
