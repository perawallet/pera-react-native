# Bottom Sheet Manager

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

2. **Do not add bottom safe-area padding.** `PWBottomSheet` passes
   `bottomInset={insets.bottom}` straight through to the underlying
   gorhom modal, so the sheet itself sits above the home-indicator area.
   Sheet contents should never call `useSafeAreaInsets()` for the bottom
   inset and should never stack extra `paddingBottom` on top of the
   host's value. Use `theme.spacing.*` for content gaps only.

3. **Use named exports** and **`makeStyles` from `@rneui/themed`** as per
   the project-wide convention.

## Deep-link triggers

If a sheet needs to be opened from a deep link or other non-React code,
register it in
`apps/mobile/src/modules/bottom-sheet/registrations.ts`. That file is the
single source of truth for the registry — like a route table. Add an
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

The `assetId` / `accountAddress` props are type-checked against the registry
entry, so a typo in the props or a missing field is a compile-time error.

**Live exemplar:** both the `ASSET_OPT_IN` case in
`apps/mobile/src/hooks/useDeepLink.ts` and `useAddAssetView`'s
`handleRequestAdd` open `OptInConfirmationContent` via
`requestByType('asset-opt-in', { assetId, accountAddress })`. The two
call paths share the same typed contract.
