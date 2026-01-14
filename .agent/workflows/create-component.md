---
description: Create a new React Native component following project conventions
---

# Create Component Workflow

Use this workflow when creating a new UI component.

## Prerequisites

Reference these before starting:

- `.agent/rules/component-patterns.md` - Detailed component patterns with examples
- `docs/FOLDER_STRUCTURE.md` - Where to place the component
- `docs/NAMING_CONVENTIONS.md` - How to name files and the component

## Steps

### 1. Determine Component Location

- **Shared component** → `apps/mobile/src/components/[ComponentName]/`
- **Module-specific** → `apps/mobile/src/modules/[module]/components/[ComponentName]/`

Note: Folder names use **PascalCase** matching the component name.

### 2. Create Component Directory

```sh
mkdir -p apps/mobile/src/components/[ComponentName]
mkdir -p apps/mobile/src/components/[ComponentName]/__tests__
```

### 3. Create Component File

Create `[ComponentName].tsx` following the pattern in `.agent/rules/component-patterns.md`:

- Use `PW` prefix for shared components (e.g., `PWButton.tsx`)
- No prefix for module-specific components
- Define props type at the top
- Use functional component with explicit return type
- Export as default

### 4. Create Styles File

Create `styles.ts` using the `makeStyles` pattern from `.agent/rules/component-patterns.md`:

- Use `makeStyles` from `@rneui/themed` (never `StyleSheet.create`)
- Export a `useStyles` hook

### 5. Create Barrel File

Create `index.ts` to re-export the component:

```typescript
// index.ts
export { default } from './[ComponentName]'
export type { [ComponentName]Props } from './[ComponentName]'
```

### 6. Create Test File

Create `__tests__/[ComponentName].spec.tsx`:

- Import from `@test-utils` for providers
- Test user behavior, not implementation
- Cover key interactions
- Use `.spec.tsx` extension (NOT `.test.tsx`)

### 7. Subcomponents (if needed)

If the component has subcomponents:

- Create them in the same folder as the main component
- Do NOT re-export them in `index.ts`
- Subcomponents should only be used by the parent component

### 8. Verify

// turbo

```sh
pnpm --filter mobile lint
```

// turbo

```sh
pnpm --filter mobile test
```
