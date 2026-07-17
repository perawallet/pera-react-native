# Will's review lens — verbatim catalog

Representative real comments from `wjbeau` across ~500 recent PR reviews, grouped by the checklist category in `SKILL.md`. Use these to calibrate tone and to recognize a category when you see it. Quotes are lightly trimmed.

## 1. Layering — logic in packages, UI thin

- "Should this hook live in the swap package instead of having it in the app?"
- "This should be in a package, not in the app." / "Shouldn't this be in the package?"
- "This feels very business-logic-y. Most of this should probably be in the swap package?"
- "This feels like it could live down in the business logic also (maybe in the zustand store). … The UI just needs to render an activity indicator and then move you on."
- "We should move this into a hook. In fact, this logic should probably just be in the business logic where registerDevice is defined."
- "Is there an argument that this should happen in the business logic? … can the signing pipeline handle this for us? That way if we ever automate this from a different place we still get the same effect."
- "We have a `useSigningAccounts` which we should use instead of filtering here. Use the logic from the package (and fix if necessary) rather than reimplementing here."
- "Should this not be in the ledger package? It's just business logic right?" / "move some of packages/ledger into the extension so it's a more complete solution and have packages/ledger be a thin wrapper like we have for kms."

## 2. Reuse before reinvention

- "We have a `useSignableAccounts` hook — probably better to use that."
- "Just use an `EmptyView` here." / "We have an EmptyView — much less code."
- "Use `PWFlatList`." / "PWFlatList" (terse, repeated).
- "I recently added a `SearchableList` component that might be useful here."
- "There is an `errorToast` function returned from `useToast` that just takes title and body — saves a few lines." / "I added a `showError(error, title?, options?)`."
- "We have a `PWRadioButton` I think you could use here." / "Is this just a `PWButton` with an appropriate variant?"
- "You could use `AddressDisplay` (it has a raw mode) and it includes copyable already."
- "We already have a constant for this in the assets package." / "You can use `DEFAULT_PRECISION` and `ALGO_ASSET.decimals`."
- "We have `Nullable` and `Maybe` already."
- Extract-for-reuse: "I think we should have this as a reusable hook because we may well want it on other screens." / "maybe `AssetChip` should live in the Assets module and be reused everywhere."

## 3. Secret & memory hygiene

- "We ideally should not be storing mnemonics in memory like this. In react-native we have no control over the heap … the GC may dereference but not clear it. The most robust approach is an array of integer indexes into the word list, which can be forcefully overwritten with 0s after use."
- "Putting the words into state defeats the purpose. We need to keep the indices until we render." / "convert individual indices to words only at display time."
- "Should we be clearing the masterKey bytes at the end of this to ensure they're zero'd out again (try/finally)?" / "need to make sure derived.privateKey is zeroed out after."
- "It's probably worth explicitly filling the existing array with '' before unassigning it. If you just unassign it, it'll still be floating in memory until GC."
- "The idea of `withSecret` is to do what you need with the secret inside the handler and then return … here we're encoding the secret into a string which ends up on the heap and is hard to clear."
- "I'm not sure we should cache the tokens — better to just go back to the keystore unless there's a compelling performance reason. We don't want these floating around in memory."
- "You shouldn't need this. If you get the key from the keystore it has a `parentKeyId` field which gives you the seed. That'll be more robust." / "derive from metadata rather than relying on a 'special' ID structure … no magic IDs floating around."
- "I'm always super nervous about implementing cryptography ourselves … maybe [the library] does what we need out of the box." / (PR#736) "should we push an upstream change rather than maintain our own native module?"
- "It might also (since we're a crypto wallet) be worth using a proper CSRNG instead of `Math.random()`."

## 4. Keep generic infrastructure generic

- "We've generally tried to avoid polluting the generic pipeline with case-specific flags and metadata. Maybe we need a `metadata` property where we can put stuff like this?"
- "I don't love this because it adds hardware-specific stuff to the general-purpose signing machine. Either a generic `metadata: Map<string, unknown>` … or hold it in a hardware-specific context."
- "Why can't we make the pipeline entirely logical/headless and have the caller react to before/afterEvent callbacks? … all the UI logic stays in the app and this engine just calls a sequence of handlers."
- "Feels weird that we have callbacks specific to a strategy implementation on the generic interface. Maybe `onBeforeApprovePrompt`/`onConnectPrompt` — something more generic other implementations can hook into."

## 5. i18n

- "i18n this?" / "i18n" (terse, very frequent).
- "These strings should be internationalized." / "not necessarily this PR but since you're here…"
- "I guess this should technically be i18n." (repeated across a whole screen)
- "There is a way to do this with tokenization so you can have this in one string and inject a component into the middle using the `<Trans>` component."
- "It's probably slightly simpler to just return the translation key from this function and wrap the call with `t(getTitle())`. `t` acts as a passthrough if it doesn't recognize the string."

## 6. Styling discipline

- "We try to avoid setting custom font sizes and line heights — just use one of the variants on PWText. If you really have to, use `getTypography` to pick a predefined style."
- "Do we really need these weird font sizes? I reckon we should just snap to an existing font size." / "This is a weird size — can we just use `theme.spacing.xxl`?"
- "theme token: `theme.borders.md`" / "getTypography or a predefined style?" / "maybe `theme.borderRadius.full`?"
- "Better to pre-build a style and assign it here. This will create a new object on every render." / "avoid inline functions ideally" / "you probably want to `useCallback` these, otherwise you spend time redefining the function on each render."
- "You can avoid the inline style by calling `useSafeAreaInsets` and passing insets into the `useStyles` call (received as the second param to createStyles)."
- "PWView" / "PWView?" (use the primitive).
- "We don't generally use `Alert` anywhere else — should this maybe be a bottom sheet?"

## 7. Component / file size

- "nit: this component feels a little overwhelming, might be worth trying to chop it up a bit?"
- "This file is getting kind of big and unwieldy. Might be worth splitting it up."
- "Let's move this to a separate hook so this component isn't so monolithic." / "Can be a separate file."
- "you could move all this stuff into `useAccountNft` and return the flatListRef from that hook to keep the component logic out of here."
- "The logic in here might be complex enough to warrant extracting a `useContactListScreen` hook for readability."

## 8. React Query / data patterns

- "I'd just return the `useQuery` — I updated CLAUDE.md to remove the statement that this shouldn't be the case." / "Maybe just return the useQuery response directly?"
- "we presumably only need to do this query if the account is not held locally, so maybe set an `enabled` flag on the query based on that?"
- "You could clean it up so the mutation calls invalidate `onSuccess`, so the UI doesn't have to remember to do it."
- "Should this maybe be derived from the data rather than stored as local state? If the user refreshes the app we probably want it to show the correct status."
- "Is there a risk that this interferes with the normal sync process? … If the two happen to run concurrently, does that cause a problem?"

## 9. Types

- "Why remove Optional?" / "Why remove Optional/Maybe?" (many times — defending deliberate nullability).
- "why do we use `new Decimal()` here and `Decimal()` in other places?" / "new vs not?"
- "Is there an argument that if we're representing microAlgos we use bigint and display units we use Decimals? Just for clarity" → then name properties `microAlgo…`.
- "Should we have a custom exception type that extends `AppError`?"
- "It's weird for a `needsOptOutTxn` function (which implies a question) to throw exceptions when the answer is 'no'. … a weird mix of boolean returns and exceptions. We should make it consistent."
- "shouldn't we match the account types to what we have in our db, even if we maintain a separate list? 'LedgerBLE' is such an odd value…"

## 10. Naming & directory structure

- "I think the directory structure here is non-standard. Check the transactions module — `modules/<domain>/screens/<subdomain>/SomeComponent/SomeComponent.tsx`."
- "If this is a navigation target, it should be in `modules/rekey/screens`, otherwise in `components`." / "Move this with RekeySuccessScreen."
- "Should this be `BackupReminderMnemonicScreen` to match the rename?"
- "These don't look intentional?" (unintended renames) / "Slightly odd name — isn't this just the user's manual selection? Maybe `userSelection`?"

## 11. Tunable constants → config / remote-config

- "Should these things be in config or even in remote-config just to make them a little easier to change?"
- "Should we move this to remote-config with sensible defaults?"
- "I think we can probably bump this up — the backend maybe supports 100, so that would cut down the number of queries by 4."
- Secrets at build time: "we can inject this at build time using bitrise secrets and locally using env vars — check out `tools/generate-config.sh`." / "one GoogleService-Info.plist and overwrite it from bitrise secrets in the build."

## 12. Comments

- "redundant comment" / "probably don't need this comment?"
- "Probably a superfluous comment — the code is self documenting."
- "I've recently been prompting Claude to cut down on the comments. It's so verbose and over the top imo." / "so many overly long comments it makes it hard to read."
- "We should probably remove comments that refer to a previous implementation — that isn't so valuable going forwards."

## 13. Correctness — Socratic edge-case probing

- "not sure what the expected behavior is but shouldn't we be checking that `next` is not null?"
- "I think this `shuffle(pool)` is wrong because you'll end up reusing the same words since you're not removing them from the pool each time."
- "Shouldn't we be doing this check before we navigate to the arc59 screen? Otherwise the user might see a double navigation if the remote query takes a while."
- "ky, our fetch client, will also retry automatically … I think you might end up retrying 6 times here. Make sure this is consistent."
- "Do we need to invalidate the unread notifications query so it requeries immediately?"
- "I think this is more correct — you don't know how long the memoized version of the keys will stick around … you could be accessing 10-day-old keys."
- "I am not seeing where we are initiating the signing pipeline. Maybe I'm missing it but we definitely need to do that."

## 14. Scope & follow-ups / cross-cutting caution

- "I don't think that needs to block this PR but maybe create a ticket for Yasin or Fred to implement?"
- "Not for this PR but maybe something to ticket." / "We can definitely do that but it should be a separate PR since it would have implications across the code base."
- "Can you confirm this against Figma? This is a pretty wide-ranging change that could fudge a lot of the UI." / "isn't this going to break all the heading styles?"
- "instead of setting this to false for all views, we should maybe be selective … otherwise it creates more performance overhead. Options: pass it via props, or `collapsable={!testID}`."
- Pragmatic merge: "I'll merge this and then open a separate PR to fix the coverage." / "This PR unblocks testing and multisig dev so I want to merge it, but it's not the right way — I'll add a ticket."

## Dependency / build hygiene (from PR-level comments)

- Lockstep bumps: "Firebase peer deps require lockstep — bumping remote-config alone would break the install."
- Audit overrides & freshness windows: "protobufjs 7.6.3 is inside the 7-day `minimumReleaseAge` window, so temporarily added to `minimumReleaseAgeExclude` … remove once it ages past the window."
- Deliberate pins: "Pera is pinned to WalletConnect v1 on purpose … adding a permanent ignore so this doesn't recur." / "`@types/node` must track the Node runtime pinned in `.tool-versions`."
- JS-only CI blind spots: "a duplicate native nitro module this group otherwise introduces (0.35.7 + 0.35.9). JS-only CI can't catch it."
