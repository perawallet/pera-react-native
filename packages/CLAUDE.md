# Zustand stores

- Location: `packages/[domain]/src/store/store.ts`
- Use `create` with `guardedPersist` from `@perawallet/wallet-core-shared` (never raw `persist`), with `storage: () => getProvider().keyValueStorage` so the adapter resolves lazily through the platform provider. A blob it cannot parse, migrate or merge is appended to a `<name>::quarantine` key before the store falls back to defaults; raw `persist` would let the next write erase it
- Bumping `version` needs a `migrate`; without one the stored state is quarantined and reset
- **Granular selectors.** Never destructure from `useStore()` directly
- Every store must include `resetState()` method (implements `BaseStoreState`)
- Separate `State` and `Actions` types, combine as `Store = State & Actions`

# Lists

- `FlashList` from `@shopify/flash-list` for anything more than a screenful, with `estimatedItemSize` set
- It ignores `contentContainerStyle` gap — use `ItemSeparatorComponent` or row padding for spacing
