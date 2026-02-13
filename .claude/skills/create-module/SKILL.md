---
description: Create a new feature module with screens and navigation
---

# Create Module

## Steps

### 1. Create Module Directory Structure

```sh
mkdir -p apps/mobile/src/modules/[module-name]/{components,screens,hooks,routes}
```

### 2. Create Main Screen

Create the primary screen following component folder structure:

```
apps/mobile/src/modules/[module-name]/screens/[ModuleName]Screen/
├── [ModuleName]Screen.tsx    # Named export, Screen suffix
├── styles.ts                 # makeStyles from @rneui/themed
├── index.ts                  # Barrel export
└── use[ModuleName]Screen.ts  # Screen logic hook (if needed)
```

### 3. Create Routes (if module needs navigation)

Create `apps/mobile/src/modules/[module-name]/routes/index.tsx` with stack navigator.

### 4. Register in Navigation

Update `apps/mobile/src/routes/` to include the new module routes.

### 5. Verify

```sh
pnpm pre-push --no-fail-on-error
pnpm test
```
