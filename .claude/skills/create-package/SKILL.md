---
description: Create a new business logic package in packages/
---

# Create Package

## Steps

### 1. Create Package Directory

```sh
mkdir -p packages/[package-name]/src/{api,hooks,models,store}
mkdir -p packages/[package-name]/src/hooks/__tests__
mkdir -p packages/[package-name]/src/store/__tests__
```

### 2. Create package.json

```json
{
    "name": "@perawallet/wallet-core-[package-name]",
    "version": "0.0.1",
    "private": true,
    "type": "module",
    "main": "./src/index.ts",
    "types": "./src/index.ts",
    "scripts": {
        "test": "vitest run",
        "lint": "eslint ."
    }
}
```

### 3. Copy Configuration Files

Copy from an existing package:

- `tsconfig.json`
- `tsconfig.build.json` (declaration emit — `pnpm run check:dts-emit` fails without it)
- `vite.config.ts`
- `vitest.config.ts`
- `eslint.config.js`

### 4. Create Index File

```typescript
// packages/[package-name]/src/index.ts
export * from './hooks'
export * from './models'
export * from './store'
```

### 5. Install Dependencies

```sh
pnpm install
```

### 6. Verify

```sh
pnpm --filter @perawallet/wallet-core-[package-name] lint
```
