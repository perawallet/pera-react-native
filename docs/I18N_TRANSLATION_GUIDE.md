# Translation guide

How to add or revise a locale bundle in `apps/mobile/src/i18n/locales/`, and the
terminology decisions the shipped bundles already made. Read this before
translating anything — most of it exists because getting it wrong is invisible
in review and only shows up on a real device.

Source of truth for the locale registry is `apps/mobile/src/i18n/locales.ts`.
Parity is enforced by `tools/i18n-lint.cjs` (`pnpm run lint:i18n`), a blocking
CI check.

## Hard mechanical rules

`lint:i18n` enforces **strict bidirectional key parity** against `en.json`:
a missing key fails, and so does an extra one.

1. **Mirror `en.json`'s key structure exactly** — same nesting, same names. Never
   add, drop, rename or re-nest.
2. **Never add plural categories to a bundle alone.** Spanish, French and
   Portuguese all have a CLDR `many` category. `en.json` mostly does not use it,
   so adding `_many` to one bundle is an _extra key_ and fails the lint. Mirror
   English's forms exactly — including `signing.transactions.title_many`, which
   `en.json` does carry. If a locale genuinely needs a category English lacks,
   the fix is to add it to `en.json` too (duplicating the `_other` text) so
   parity holds — see the plural-category section below before doing that.
3. **Preserve `{{interpolation}}` placeholders verbatim** — same names, same
   count. Never translate a variable name.
4. **Preserve rich-text tags exactly** — `<0>…</0>`, `<1>…</1>`. The numbers map
   to React components; renumbering mis-renders. You may move a tagged span to
   respect target word order, but the tag must still wrap the same content.
5. **Never translate brand or protocol names**: Pera, Pera Wallet, Algorand,
   Algo, ALGO, ASA, MainNet, TestNet, WalletConnect, Ledger, Bidali, Meld,
   Discover, Pera Card, Vault, Face ID, Touch ID.
6. **Non-ASCII goes in literally** (`á`, `ü`, `ç`, `ğ`, `ı`), never as `\uXXXX`.

## Terminology policy

German set the house style and it is deliberate:

- **Translate general finance/UI vocabulary** where the language has a natural
  term — `Recovery Phrase` → `Wiederherstellungsphrase`, `Minimum Balance` →
  `Mindestguthaben`, `Shared Account` → `Gemeinschaftskonto`.
- **Keep Algorand/crypto ecosystem terms in English** — `Asset`, `Vault`,
  `Staking`, `Rekey`, `Passphrase`, `Swap`, `passkey`. German even inflects them
  natively (`rekeyen`, `deines Vaults`) rather than inventing a calque.

Languages borrow English at different rates, so **two terms deliberately diverge
between bundles**. Do not "harmonise" these without reading why:

| Term     | de       | es       | fr       | tr           | pt-BR    | Why                                                                                                                                                                                                                                         |
| -------- | -------- | -------- | -------- | ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asset`  | `Asset`  | `activo` | `actif`  | `varlık`     | `ativo`  | German borrows English tech vocabulary readily; the Romance languages and Turkish do not, and `activos`/`ativos` is what Binance/Coinbase ship in those languages.                                                                          |
| `wallet` | `Wallet` | `wallet` | `wallet` | **`cüzdan`** | `wallet` | Kept English in Spanish specifically to dodge the `cartera` (Spain) / `billetera` (LatAm) split in a single neutral `es` bundle. Turkish has no such split and its crypto UIs universally say `cüzdan`, so translating it there is correct. |

## Register per locale

| Locale  | Register          | Notes                                                                                                                                                                                                                                      |
| ------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `de`    | informal `du`     |                                                                                                                                                                                                                                            |
| `es`    | informal `tú`     | Never `usted`. The `usted` imperative (`Introduzca`) is the most common slip. Neutral Spanish: no `vos`, no `vosotros`.                                                                                                                    |
| `fr`    | **formal `vous`** | A deliberate exception. French financial and crypto apps use `vous` near-universally (Coinbase, Ledger Live, Binance, Revolut); `tu` reads as unserious for an app holding real money. **Do not "correct" this toward the other bundles.** |
| `tr`    | informal `sen`    | `Gir`, not `Girin`; `hesabın`, not `hesabınız`.                                                                                                                                                                                            |
| `pt-BR` | `você`            | Neutral rather than markedly informal in Brazilian Portuguese, so no tension with the house style. Never `tu` or `o senhor`.                                                                                                               |

**Sentence case everywhere.** English Title-Cases buttons (`Buy Gift Card`); no
other locale should.

## Plural categories, and the one that will bite a future locale

**A missing plural form does not fall back to that locale's `_other` — it falls
back to English.** Measured, not assumed: with `lng: 'es'` and `count: 1000000`,
`messages.inbox.asa_requests` returns `"1000000 incoming assets"`. i18next treats
the absent `asa_requests_many` as a missing key and resolves it through
`fallbackLng: 'en'`.

An unsuffixed **base key catches any category the suffixes don't cover.** The
three groups shaped `count` + `count_one` (rather than `count_one` +
`count_other`) return localised text at 1,000,000 for exactly this reason.

### Today: a real gap, but unreachable

`es`, `fr` and `pt-BR` have a `many` category, and CLDR fires it only on **exact
multiples of 1,000,000** with no decimals — the `1 000 000 de dollars` form. All
32 plural groups count bounded UI entities (18 accounts, 5 transactions, 2
seconds, 2 warning actions, and one each of NFT/asset/key/permission/address), so
none can reach it. `de` and `tr` have no `many` category at all.

So no action is needed for the current five locales. Don't blanket-add `_many` to
`en.json` either: bidirectional parity would then force those ~29 dead keys into
`de` and `tr`, which can never select `many`, and into every locale added later.

### Before adding a locale with `few`, `two` or `zero`, fix this properly

This stops being theoretical the moment Pera ships Polish, Russian, Czech,
Arabic or Welsh. Russian and Polish both select **`few` for counts 2–4** — so
every one of the ~29 `_one`+`_other` groups would render **English** for a count
of 2, on very common screens.

The robust fix is to give every plural group an unsuffixed **base key** carrying
the general plural text, because that catches all unmatched categories at once.
Per-category duplication (`_many`, then `_few`, then `_two`…) is a point fix that
has to be repeated for every category and every locale.

Either way it is an `en.json` change plus a mirrored update to all bundles, so do
it as its own change rather than inside a locale PR.

## Locale-specific traps

### Turkish — agglutination is the big one

Case suffixes are chosen by **vowel harmony**, so a suffix written directly after
a `{{placeholder}}` is wrong for most runtime values. `{{assetName}}'yu` is only
correct when the value happens to end in a back vowel.

**Rule: never attach a case suffix to a placeholder.** Restructure so the
inflection lands on a fixed noun:

```
BAD   {{assetId}}'yi                GOOD  {{assetId}} ID'li varlığı
BAD   {{deviceName}}'e bağlanılıyor  GOOD  {{deviceName}} cihazına bağlanılıyor
BAD   {{origin}}'den geldi           GOOD  İstek {{origin}} adresinden geldi
BAD   {{requested}}'te               GOOD  {{requested}} ağında
```

Check with `grep -P '\}\}\p{L}'` over the bundle — it should return nothing.

Also: **dotted vs dotless i are different letters.** Uppercase of `i` is `İ`, of
`ı` is `I`. So `İşlem`, `İptal`, `İleri` — but `Irak` correctly keeps the dotless
`I`. And put an apostrophe before suffixes on proper nouns and acronyms:
`ALGO'yu`, `Pera'ya`, `URI'si`.

### French — typography

- **Narrow no-break space (U+202F) before `: ; ! ?`** and inside `« »`. Literal
  character, not an escape: `Bienvenue sur Pera !`, `Attention : …`
- **Typographic apostrophe `’`**, not `'`.
- Guillemets `« »` for quotation, not `" "`.
- `frais` is always plural (`les frais sont`).

### pt-BR — Brazilian, and it reaches further than Brazil

`LOCALE_ALIASES` in `locales.ts` maps bare `pt` → `pt-BR`, so a device reporting
`pt-PT` resolves here too. Write Brazilian anyway: `celular`, `tela`, `senha`,
`arquivo`, `contato`, `saque`, `aba`, `compartilhada` — never `telemóvel`,
`ecrã`, `palavra-passe`, `ficheiro`, `contacto`, `partilhada`.

Because `wallet` stays English, its **gender** is undefined and needs a house
choice: it is **feminine** throughout (`a wallet`, `a Pera Wallet`), by analogy
with `carteira`. Same for `passkey`.

### Spanish — one neutral bundle

Serves Spain and LatAm from one file. Avoid Spain-only (`vale`, `móvil`) and
LatAm-only (`celular`) vocabulary. `cantidad` for "amount", not Spain-leaning
`importe` or LatAm-leaning `monto`.

## Known `en.json` problems

Translators keep hitting these; they are source-string bugs, not translation
decisions:

- **PERA-4832** — `en.json` calls the recovery phrase both "recovery passphrase"
  (13 strings) and "Recovery Phrase" (3 strings in `view_passphrase.acknowledge`),
  **including both in one sentence** (`onboarding.import_info.body`). `de`, `es`
  and `tr` mirror the split; `fr` flattens it. Wants an English-side fix driving
  a coordinated bundle update, not per-language patching.
- `walletconnect.request.networks_mainnet` / `networks_testnet` spell it
  `Mainnet`/`Testnet` where the rest of the app uses `MainNet`/`TestNet`.
- `signing.arc60_view.details_title` misspells "Athentication".
- `transactions.warning.close_group_warning` is missing a "to".

## Workflow that works

For a full bundle (~2,600 strings), translating in one pass is impractical.
What worked:

1. **Split `en.json` by namespace** into ~11 balanced groups of ~250 leaves, with
   an assertion that every namespace is assigned exactly once. `countries` (279
   keys) and `peraCard` (387) are big enough to own a group each.
2. **Write the register + glossary decisions down first** and give the same text
   to every group. Parallel translators cannot coordinate, so the glossary is the
   only thing keeping one concept from getting five renderings.
3. **Reconcile centrally afterwards.** Expect collisions — "watch account" came
   back three different ways in Spanish. Prefer exact-string replacements over
   regex when the language inflects, so agreement cannot be mangled.
4. **Validate against `en.json` mechanically** before committing: key parity both
   ways, placeholder and rich-tag sets per key, no `\uXXXX`, plus the
   locale-specific greps above.
5. **Rebuild the bundle in `en.json`'s key order** rather than mutating an older
   file. That guarantees no stale key survives and the committed file diffs
   cleanly against its siblings.
6. **Re-check parity immediately before opening the PR.** `en.json` moves; a
   bundle validated an hour ago can already be short. `lint:i18n` will catch it,
   but only after CI has run.

## Validating on device

`pnpm --filter mobile locale-tour --locale <tag>` drives ~145 surfaces and
reports text overflow. See `docs/TESTING.md` for preconditions.

**Read the report with a caveat:** the probe's `wider-than-parent` rule
over-reports. It flagged the same home-screen strings in `de`, `es`, `tr` and
`pt-BR` — including four-character `NFTs` — and flagged three strings in `fr` on
one run and none on the next with the same copy. Visual checks did not reproduce
clipping. Treat `wider-than-parent` as a prompt to look at the screenshot;
`truncated` is the signal worth acting on.

Also note the report's own PNG-attribution warning: screenshots are not
guaranteed to show the step they are filed under. The overflow JSON is written
in-process and is reliable; the images are best-effort.

## Shipping a locale is not enabling it

`getEffectiveSupportedLocales` intersects the shipped bundles against the
`active_locales` Remote Config CSV, and the picker itself is gated behind
`enable_language_selection`. Adding a bundle does not expose it to users — the
backend has to list the tag and the flag has to be on.
