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

Match the shape of an existing package (`packages/arc0027` is the smallest current example).
`main`/`types`/`exports` point at `dist/` — packages ship built output, not source:

```json
{
    "name": "@perawallet/wallet-core-[package-name]",
    "private": true,
    "version": "0.0.0",
    "main": "dist/index.js",
    "types": "dist/index.d.ts",
    "type": "module",
    "exports": {
        ".": {
            "types": "./dist/index.d.ts",
            "default": "./dist/index.js"
        }
    },
    "scripts": {
        "build": "vite build && tsc -p tsconfig.build.json",
        "dev": "vite build --watch & tsc -p tsconfig.build.json --watch --preserveWatchOutput",
        "test": "vitest run",
        "test:unit": "vitest run",
        "lint": "oxlint --config ../../.oxlintrc.json src --ignore-pattern "src/**/__tests__/**""
    },
    "devDependencies": {
        "@perawallet/wallet-core-devtools": "workspace:*",
        "typescript": "catalog:",
        "vite": "catalog:",
        "vitest": "catalog:"
    }
}
```

### 3. Copy Configuration Files

Copy from an existing package:

- `tsconfig.json`
- `tsconfig.build.json` (declaration emit — `pnpm run check:dts-emit` fails without it)
- `vite.config.ts` (update the `external` list to this package's dependencies)
- `vitest.config.ts`

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
pnpm --filter @perawallet/wallet-core-[package-name] build
pnpm --filter @perawallet/wallet-core-[package-name] lint
pnpm run check:dts-emit
```
