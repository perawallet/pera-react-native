# Code Review — `yasince/ui-cleanup` vs `origin/main`

**Method:** Multi-agent review (123 agents) over the full branch diff, with adversarial verification of every high/medium finding (each claim was independently reproduced against real code before inclusion).
**Volume:** 45 confirmed findings (high/medium, verified) + 97 low findings (categorized, unverified). After deduplication the confirmed set collapses to **~41 distinct issues** across 11 themes.
**Overall:** The refactor is directionally strong — it centralizes screen/sheet layout into `PWScreen`/`PWSheetLayout`/`PWScrollView`/`PWFlatList` and removes a lot of bespoke spacing. The risk is concentrated in two places: **(1) keyboard/tap and safe-area regressions** from incomplete migration of list/sheet props, and **(2) scope creep** (production config, editor config, dev tooling) riding inside UI commits. Recommendation: **address Theme A + B + C before merge**, split out Theme J, and backfill Theme I tests.

> Snapshot note: this report reflects the branch state the workflow reviewed. Several items have since been resolved in-session (flagged ✅ below) — verify against current `HEAD`.

---

## Severity overview

| Severity | Count | Nature |
|---|---|---|
| **High** | 3 | Real interaction/layout regressions reachable by users |
| **Medium** | 39 | Layout/safe-area defects, reuse/centralization misses, missing tests, scope creep, dead code |
| **Low** | 97 | Conventions (28), styling tokens (19), duplication (10), testing (9), overengineering (7), reuse (6), scope (4), bug (8), typescript (3), architecture (2), hooks (1) |

---

## Theme A — Keyboard & tap regressions (HIGH priority)

The migration to `PWFlatList` / `PWScreen` dropped keyboard props that were load-bearing. `PWFlatList` sets **no default** for `keyboardShouldPersistTaps`, so FlashList falls back to RN's `'never'` — the first tap with the keyboard up is swallowed by dismissal instead of selecting.

| Sev | File | Issue |
|---|---|---|
| **HIGH** | `components/AddressSearchView/AddressSearchView.tsx:195` | In-sheet `PWFlatList` lost `keyboardShouldPersistTaps='handled'` → first tap on a result row dismisses the keyboard instead of selecting (hits multisig AddParticipant). |
| MED | `modules/contacts/screens/ContactListScreen/ContactListScreen.tsx:113` | Same: dropped `keyboardShouldPersistTaps`/`keyboardDismissMode` → first tap on a contact row / QR icon swallowed while search focused. |
| MED | `modules/contacts/screens/EditContactScreen/EditContactScreen.tsx:56` + `useContactListScreen` | Removed `Keyboard.dismiss()` before opening sheets → keyboard can stay up over the delete-confirm / QR sheet (sticky footer tap doesn't blur the field; presenting a sheet isn't a nav blur). |

**Fix (centralized):** default `keyboardShouldPersistTaps='handled'` on `PWFlatList` (matching `PWScrollView`, which already defaults it) so every migrated search+list screen behaves correctly, then drop the per-screen props. Re-add `Keyboard.dismiss()` on the sheet-open path (or dismiss-on-present in `PWBottomSheet`).

---

## Theme B — Bottom-inset / safe-area double-padding & loss (HIGH/MED)

The project rule is *PWScreen/PWScrollView own the bottom inset; nested lists/footers must not re-pad*. Several migrations violate it in both directions.

| Sev | File | Issue |
|---|---|---|
| **HIGH** ✅ | `modules/messages/.../MultisigInvitationDetailContent/styles.ts:50` | Sticky footer lost all vertical padding + safe-area clearance → Ignore/Add buttons flush against the sheet edge. *(Resolved in-session: refactored to `PWSheetLayout` footer slot.)* |
| MED | `modules/gift-card/.../BidaliAccountSelectionScreen.tsx:41` | In-sheet list wrapped in `PWScreen scroll={false}` **and** inner `PWFlatList` both add the bottom inset → oversized empty band. Render `AccountPicker` bare (like receive-funds). |
| MED | `modules/gift-card/.../BidaliWebViewScreen.tsx:24` | `PWScreen scroll={false}` adds a bottom band under a full-bleed webview. Keep it a `flex:1 PWView`. |
| MED | `modules/assets/.../CollectibleDetailScreen.tsx:108` | `contentContainerStyle={{paddingBottom: xl}}` overrides PWScreen's `bottomInset` (~50→24), regressing home-indicator clearance. Drop the override. |
| MED | `modules/transactions/.../SendFundsInfoContent.tsx:41` | `PWScrollView` auto-inset **and** manual footer inset both apply → inset counted twice; inflates an `auto` sheet. Give `scrollContent` an explicit `paddingBottom` so PWScrollView opts out. |

---

## Theme C — `PWSheetLayout` migration contract gaps (HIGH/MED)

`PWSheetLayout` only scrolls/lays out when the sheet is opened with `autoCreateContainer: false`; and its `body` bottom padding is owned by the primitive (`bodyBottom`/merged `body`), so caller `paddingBottom` is dead.

| Sev | File | Issue |
|---|---|---|
| **HIGH** ✅ | `hooks/useDeepLink.ts:297` | Asset-opt-in deep link opens the migrated `OptInConfirmationContent` without `autoCreateContainer:false` → broken scroll/layout. *(Resolved in-session.)* |
| MED | `modules/.../gallery-catalog/sheets.catalog.tsx:982` | Dev-gallery staking launchers missing `autoCreateContainer:false` (and `size` for help) → won't scroll. |
| LOW | `modules/multisig/.../ExportShareAccountContent/styles.ts:16` | `body.paddingBottom: xxl` is dead (overridden by PWSheetLayout). *(The `bodyBottom` style has since been merged into `body` in-session.)* |

---

## Theme D — List separator / spacing regressions (MED)

| Sev | File | Issue |
|---|---|---|
| MED | `modules/signing/.../TransactionListScreen.tsx:59` | Dropped custom `ItemSeparatorComponent` without adding `cardLayout` → PWFlatList's default inset hairline now cuts across bordered cards. Add `cardLayout` (maps to `CardSeparator`, `md` gap). |
| MED | `modules/messages/.../InboxScreen.tsx:57` & `NotificationsScreen.tsx:62` | Redundant `listEdgeSpacer` header now double-pads the list top (`2×xl` top vs `xl` bottom) since PWFlatList adds vertical padding. Remove the spacer (sibling adopters already dropped it). |

---

## Theme E — Reuse / centralization misses (MED)

The PR introduces the right primitives but leaves a cluster of components hand-rolling what the primitives now own.

| Sev | File | Issue |
|---|---|---|
| MED | `AccountActionsContent`, `SharedAccountDetailsContent`, `SwapIntroductionContent`, `SendFundsInfoContent` (+ ~10 listed: SwapConfiguration, BeforeYouCreate, Ratings, TransactionsFilter, AccountSort, LedgerConnecting, ConfirmAction…) | Hand-roll raw `BottomSheetScrollView` + manual `useSafeAreaInsets()`/`bottomInset` instead of `PWScrollView inBottomSheet` / `PWSheetLayout`, which already centralize sheet detection + inset. Adopt the primitive and delete the per-component plumbing. |
| MED | `modules/multisig/.../SetThresholdScreen.tsx:56` | Re-inlines the `ParticipantCount` primitive (icon+count) by hand just to add an alignment spacer. Restore `<ParticipantCount>`. |
| MED | `modules/multisig/.../SetThresholdScreen/styles.ts:25` | Count column duplicates `ThresholdStepper`'s internal widths (`3xl`/gap) → silent misalignment if the stepper changes. Share a row primitive or expose the metrics. |
| MED | `modules/accounts/.../AccountTabNavigator.tsx:43` | Inline `style={{flex:1}}` + `sceneStyle:{flex:1}` on `Tab.Navigator`; the fix belongs in the shared `createPWTabNavigator` (PWTabView) so all 3 navigators get it. |

---

## Theme F — Overengineering / speculative API (MED/LOW)

| Sev | File | Issue |
|---|---|---|
| MED | `components/core/PWInput/PWInput.tsx:61` | New `multiline` prop has **zero callers** and the shared `input` style (`paddingVertical:0`, `textAlignVertical:'center'`, `flex:1`) makes it non-functional anyway. Drop it until needed. |
| MED | `components/ConfirmActionContent/ConfirmActionContent.tsx:27` | `titleAlign` prop added with **zero callers** (other broadenings here are justified). Drop `titleAlign`. |
| LOW | `modules/.../AccountAssetSelectionList` | `hasPadding` prop is now dead end-to-end after padding moved to the parent; still passed `hasPadding={false}`. Remove the knob. |
| LOW | `modules/assets/hooks/useCollectibleItem.ts` | `collectionName` no longer consumed in production (replaced by `collectionLabel`). Remove the dead field. |

---

## Theme G — Architecture / layering (MED)

| Sev | File | Issue |
|---|---|---|
| MED | `modules/accounts/hooks/useMultisigDetailsBackfill.ts` | Cross-domain orchestration (multisig API query → domain mapping → account store write) lives in the **app layer**. Per *logic in packages, UI in app*, move to `packages/accounts` (or `packages/multisig`) alongside `useAccountDiscovery`/`useRekeyTransition`. Caveat: introduces an accounts→multisig package dep, so `packages/multisig` may be the better home. |

---

## Theme H — Styling: inline styles & token violations (MED)

| Sev | File | Issue |
|---|---|---|
| MED | `modules/onboarding/.../AddAccountScreen.tsx:63` | Inline `style={{paddingTop: insets.top}}` — thread `insets` through `makeStyles` (established pattern). |
| MED | `components/AddressDisplay/AddressDisplay.tsx:193,212` | nfd/plain-address branches force `weight={500}` before `{...textProps}`, overriding a caller's `variant` (ViewContact renders address at 500 not 400). Use the guarded `weight={textProps?.variant ? undefined : 500}` like the other branches. |
| MED | `modules/multisig/.../MultisigIntroductionDialog/styles.ts:65` | `continueButton.marginBottom: md` stacks on PWDialog's footer padding → 24px instead of 12px. Drop it. |

---

## Theme I — Test coverage gaps (MED)

Core components, hooks, and exported utils require tests; several new behaviors landed untested.

| Sev | File | Issue |
|---|---|---|
| MED | `components/core/PWFlatList/PWFlatList.tsx` | Substantial new branching (separator resolution, sheet auto-detect, fillEmpty, content-padding) in a **core component with no `__tests__` at all**. |
| MED | `modules/assets/hooks/useCollectibleItem.ts` | New `collectionLabel = collectionName ?? asset.unitName` fallback untested. *(Reported 3× by independent agents — one issue.)* |
| MED | `modules/assets/.../useCollectibleDetail.tsx` | New `hasImage`/`hasSaveableMedia` / model-vs-fullscreen split / save-path logic untested. |
| MED | `theme/typography.ts:144` | JSDoc claims a "guard test" that **doesn't exist**; new exported `getVariantFontWeight` (drives ALGO glyph weight) untested. Add the guard test or remove the claim. |
| MED | `vitest.setup.ts:2601` | `useStakingProjectsQuery` mock returns `stakingProjects` but the real hook + consumer use `data` → `projects` is `undefined` in tests (latent). Rename mock key to `data`. |

---

## Theme J — Scope creep (MED) — split out of this PR

| Sev | File | Issue |
|---|---|---|
| MED | `.claude/settings.json` | New committed file granting `Bash(xargs cat)` — unrelated tooling-policy change; convention is to keep Claude config gitignored (`settings.local.json`). |
| MED | `packages/config/src/main.ts:103` + `.env.example` | Production node/indexer/backend URLs repointed, staging→prod, OSS AlgoNode defaults + dev API key removed — **production infra change** bundled in a `refactor(ui)` commit. Split into its own reviewed PR. |
| LOW | `.vscode/settings.json` | Personal editor / `java.import.exclusions` config (irrelevant to an RN app). |
| LOW | `RescanRekeyedSelectScreen.tsx` | Removed a select-all checkbox `testID` — out of scope. |
| LOW/SCOPE | `routes/galleryTour.ts`, `gallery-catalog/*`, `useGalleryReviewStore.ts` | Self-described "throwaway / remove after use" dev-gallery harness wired into a shipping dev button. → Track on the separated `feat/dev-gallery` branch; most gallery-tagged lows belong there, not in ui-cleanup. |

---

## Theme K — Dead code / build hygiene (MED/LOW)

| Sev | File | Issue |
|---|---|---|
| MED | `modules/rekey/utils/selectTargetScreenStyles.ts` | `getSelectTargetScreenStyles` orphaned — its only 3 importers were deleted in this PR. Delete the util. |
| MED | `packages/dev-fixtures/vite.config.ts:38` | `decimal.js` used at runtime (`new Decimal(...)`) but missing from `rollupOptions.external` → bundled duplicate, risks `instanceof`/precision-config divergence. Externalize it (+ add the two imported workspace deps). |
| MED | `gallery-catalog/module-components.catalog.tsx:147` | `import type` block interleaved after component declarations (import-order rule). |
| LOW | `packages/dev-fixtures/package.json` | 4 declared deps never imported; externals list inconsistent with actual (type-only) imports. |

---

## Low findings — themed summary (97)

The lows are dominated by mechanical/convention items; representative call-outs:

- **Conventions (28):** import-order violations (third-party after alias, `import type` placement) across ~8 files; **removed intent-explaining comments** for non-obvious gating (`useAccountOptions`, `useTransactionConfirmationScreen`, `useWalletConnectProvider`, swallowed `UserRejectedSigningError`); stale comments referencing removed buttons; deliberate `import type` downgraded to value import; hardcoded English in dev menu items.
- **Styling tokens (19):** redundant `as const` in `makeStyles` (Claim/TransactionProcessing), `flex:1` added to shared `AssetNameBadge`/`AssetActionButtons` affecting all callers, `borderRadius` using spacing token, button styles named by count not intent, detail screens losing top padding on `PWView(xl)→PWScreen(scroll=false)`, silent button-variant change (secondary→primary) on ConnectionSuccess.
- **Duplication (10):** dead/unused styles left after refactor (`contentContainer`, `listEdgeSpacer`, redundant `flex:1`/`alignItems`), `variantFontWeights` duplicating `getTypography`, the sheet auto-detect snippet copy-pasted in both `PWScrollView` and `PWFlatList` (extract a shared `useIsInBottomSheet`).
- **Bug (8, unverified):** 3D-model badge rendering on every carousel page, `PWToolbar` `sideMinWidth` growing monotonically, `AccountSortContent` draft state stale while sheet open, `AssetDetailsScreen` `PWScreen scroll=false` wrapping a `Tab.Navigator`, `keyboardDismissMode='on-drag'` dropped from swap/add-asset search lists (same family as Theme A).
- **Overengineering (7):** speculative opt-outs/props with no caller (`PWDialog.dismissOnBackdropPress`, `AddressDisplay.hugContent`/`AccountPicker.highlightedAddress`, `useMultisigDetailsBackfill.isBackfilling`), compile-time constant threaded through `useStyles`, over-stubbed keyboard-controller test mock.
- **Reuse (6):** siblings not migrated to the new primitives (`LedgerVerifyScreen` hero header vs `ScreenHeader`; `TransactionRequestFAQContent`/`ViewPassphraseContent` not on `ConfirmActionContent`/`PWSheetLayout`; `LedgerScanScreen` permission-denied hand-composed vs `EmptyView`).
- **Testing (9):** several gallery/store hooks untested (track with `feat/dev-gallery`); `usePWScreenInsets` test asserts a mock-only `24` diverging from prod `16`; `PWSheetLayout` spec is render-only; stale test name after `lg→modal`.
- **TypeScript (3):** unchecked `verificationTier` string→enum cast; unnecessary `as unknown as` defeating `navigationRef` typing; redundant `as string`.

---

## Cross-cutting recommendations

1. **Centralize the keyboard defaults (Theme A).** Default `keyboardShouldPersistTaps='handled'` (and consider `keyboardDismissMode`) on `PWFlatList` so the search+list migration is correct everywhere by construction, rather than per-screen. This single change closes the HIGH + 2 MED + 2 LOW tap regressions.
2. **Finish the inset-ownership migration (Theme B/E).** Sweep the ~14 sheet bodies still hand-rolling `BottomSheetScrollView` + manual inset onto `PWScrollView inBottomSheet` / `PWSheetLayout`; this both fixes the double-pad defects and removes the duplicated plumbing.
3. **Split scope (Theme J).** Carve `packages/config` (prod URLs/keys), `.claude/settings.json`, `.vscode`, and the dev gallery into separate PRs so infra/tooling changes are reviewed on their own merits.
4. **Backfill tests (Theme I)** for the new core-component and hook logic before merge — `PWFlatList`, `useCollectibleDetail`, `useCollectibleItem.collectionLabel`, and the `getVariantFontWeight` guard test.
5. **Adopt-across-callers discipline.** Most reuse findings are the same root cause: a primitive was introduced but not adopted in every sibling in the same PR. A quick grep sweep per new primitive (`ScreenHeader`, `ConfirmActionContent`, `PWSheetLayout`, `EmptyView`) closes the Theme E + reuse lows.

---

*Generated from multi-agent workflow `w27sw93zk` (123 agents; high/medium findings adversarially verified, lows categorized but unverified).*
