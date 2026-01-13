---
description: Create a new feature module in the mobile app
---

# Create Module Workflow

Use this workflow when creating a new feature module.

## Prerequisites

Before starting, read:

- `docs/FOLDER_STRUCTURE.md` - Module structure
- `docs/ARCHITECTURE.md` - Module responsibilities

## Steps

### 1. Create Module Directory Structure

```sh
mkdir -p apps/mobile/src/modules/[module-name]/{components,screens,hooks,routes}
```

### 2. Create Main Screen

Create `apps/mobile/src/modules/[module-name]/screens/[ModuleName]Screen.tsx`:

- Name with `Screen` suffix
- Create matching `.styles.ts` file

### 3. Create Routes (Optional)

If module needs navigation:

Create `apps/mobile/src/modules/[module-name]/routes/index.tsx`

### 4. Register in Navigation

Update `apps/mobile/src/routes/` to include the new module routes

### 5. Verify

// turbo

```sh
pnpm --filter mobile lint
```

// turbo

```sh
pnpm --filter mobile test
```
