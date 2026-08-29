# Zustand stores

- Location: `packages/[domain]/src/store/store.ts`
- Use `create` with `persist` middleware; stores use `createJSONStorage(() => getProvider().keyValueStorage)` from `zustand/middleware` so the storage adapter resolves lazily through the platform provider
- **Granular selectors.** Never destructure from `useStore()` directly
- Every store must include `resetState()` method (implements `BaseStoreState`)
- Separate `State` and `Actions` types, combine as `Store = State & Actions`

# Lists

- `FlashList` from `@shopify/flash-list` for anything more than a screenful, with `estimatedItemSize` set
- It ignores `contentContainerStyle` gap — use `ItemSeparatorComponent` or row padding for spacing
