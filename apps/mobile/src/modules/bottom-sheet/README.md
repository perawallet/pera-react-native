# Bottom sheet manager

A central manager renders any bottom sheet requested from anywhere in the app.

## Opening a sheet

```tsx
const { request } = useBottomSheet()

const result = await request<'confirm' | 'cancel'>({
    contents: <ConfirmRemoveBottomSheet accountId={id} />,
    options: { size: 'auto' },
})
if (result === 'confirm') {
    await removeAccount(id)
}
```

## Inside a sheet

```tsx
const { resolve, dismiss } = useBottomSheetResult<'confirm' | 'cancel'>()

<PWButton title='Yes' onPress={() => resolve('confirm')} />
<PWButton title='No'  onPress={() => resolve('cancel')} />
// Pan-down / backdrop close => caller receives `undefined`.
```

## Rules

1. **Sheet props at request time must be identifiers, not live values.**
    - Good: `<RenameAccountContent accountId={id} />`
    - Bad: `<RenameAccountContent accountName={name} />`

    Live data is read inside the sheet via hooks (Zustand stores / TanStack
    Query). Props captured at `request()` time never update.

2. **Sheet content owns the bottom safe-area inset.** `PWBottomSheet` draws
   edge-to-edge (`bottomInset={0}`), so its background extends under the home
   indicator and nav bar. The host `innerContainer` does not add the inset, so
   each sheet's content must, or the last row or CTA sits under the nav bar.
   Don't double up.
    - Scroll content adds it inside the scroll. `PWSheetLayout`, `PWFlatList`
      and `PWScrollView` with `inBottomSheet`, and raw `BottomSheetScrollView`
      sheets all do this.
    - A fixed footer adds it instead. `PWSheetLayout`'s `footer` slot does so
      automatically; hand-rolled footers add `insets.bottom` themselves.
    - Prefer `PWSheetLayout`. It is the sheet skeleton, with a sticky `header`,
      a scrolling `children` body, an optional pinned `footer`, and a
      `horizontalPadding` prop.
    - A content-sized sheet (`size='auto'`) grows to fit and then scrolls, and
      uses the default container. A sheet whose body must scroll within a bound
      needs `autoCreateContainer={false}` so the scroll gets a definite height.
      The `footer` slot only pins under that same flag; in an auto-sized sheet
      put the buttons in the body instead.
    - Exception: `ModelViewerBottomSheet` is a direct `BottomSheetModal` rather
      than a `PWBottomSheet`, so it owns its own inset.

3. Named exports and `makeStyles` from `@rneui/themed`, per the project-wide
   convention.

## Deep-link triggers

If a sheet needs to be opened from a deep link or other non-React code,
register it in
`apps/mobile/src/modules/bottom-sheet/registrations.ts`. That file is the
single source of truth for the registry, like a route table. Add an
import + a `registerBottomSheet(...)` call + a `BottomSheetRegistry`
augmentation entry:

```tsx
import { registerBottomSheet } from './registry/registry'
import { OptInConfirmationContent } from '@modules/assets/components/OptInConfirmationContent'

registerBottomSheet('asset-opt-in', OptInConfirmationContent)

declare module '@modules/bottom-sheet' {
    interface BottomSheetRegistry {
        'asset-opt-in': {
            assetId: string
            accountAddress: string
        }
    }
}
```

`registrations.ts` is imported once at app bootstrap from `RootComponent`,
so every entry binds before any deep link can fire. Non-React callers
(deep-link handler, native event listeners, etc.) can then open the sheet
imperatively:

```ts
useBottomSheetStore.getState().requestByType('asset-opt-in', {
    assetId,
    accountAddress,
})
```

React callers can use the same path via `useBottomSheet().requestByType(...)`.

Props are type-checked against the registry entry, so a typo or a missing field
is a compile-time error.

For a worked example, the `ASSET_OPT_IN` case in
`apps/mobile/src/hooks/useDeepLink.ts` and `useAddAssetView`'s
`handleRequestAdd` both open `OptInConfirmationContent` through
`requestByType('asset-opt-in', { assetId, accountAddress })`, sharing one typed
contract.
