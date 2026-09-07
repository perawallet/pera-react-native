# Pera Mobile App

The React Native application. Setup and repo-wide commands live in the
[root README](../../README.md); this covers what is specific to the app.

```sh
pnpm install
pnpm expo:prebuild   # generate native folders, first run or after a clean
pnpm start
pnpm ios             # or: pnpm android
pnpm test
```

## Two rules that catch most review comments

Business logic lives in `packages/*`. Import it, don't reimplement it in the app:

```typescript
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
```

Design-system components are `PW`-prefixed, live in `src/components/core/`, and are imported from the
barrel:

```typescript
import { PWButton } from '@components/core'
```

## Troubleshooting

Native code or dependency problems usually clear with `pnpm expo:prebuild`, or
`pnpm expo:prebuild:clean` for a full regeneration. A confused bundler clears with
`pnpm start -- --reset-cache`.

## Learn more

- [Architecture](../../docs/ARCHITECTURE.md) for how the layers fit together
- [Code Layout](../../docs/CODE_LAYOUT.md) for where files go and what to call them
