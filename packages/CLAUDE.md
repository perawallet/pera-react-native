# Zustand Stores

- Location: `packages/[domain]/src/store/store.ts`
- Use `create` with `persist` middleware; stores use `createJSONStorage(() => getProvider().keyValueStorage)` from `zustand/middleware` so the storage adapter resolves lazily through the platform provider
- **Granular selectors** — never destructure from `useStore()` directly
- Every store must include `resetState()` method (implements `BaseStoreState`)
- Separate `State` and `Actions` types, combine as `Store = State & Actions`
