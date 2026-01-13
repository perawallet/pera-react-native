---
description: Create a new business logic package in the packages directory
---

# Create Package Workflow

Use this workflow when creating a new business logic package.

## Prerequisites

Before starting, read:

- `docs/FOLDER_STRUCTURE.md` - Package structure
- `docs/ARCHITECTURE.md` - Package responsibilities

## Steps

### 1. Create Package Directory

```sh
mkdir -p packages/[package-name]/src/{hooks,models,store}
mkdir -p packages/[package-name]/src/hooks/__tests__
mkdir -p packages/[package-name]/src/store/__tests__
```

### 2. Create package.json

Create `packages/[package-name]/package.json`:

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

### 3. Create Configuration Files

1. Copy `tsconfig.json` from another package
2. Copy `vite.config.ts` from another package
3. Copy `vitest.config.ts` from another package
4. Copy `eslint.config.js` from another package

### 4. Create Index File

Create `packages/[package-name]/src/index.ts`:

```typescript
export * from './hooks'
export * from './models'
export * from './store'
```

### 5. Install Dependencies

// turbo

```sh
pnpm install
```

### 6. Verify

// turbo

```sh
pnpm --filter @perawallet/wallet-core-[package-name] lint
```
