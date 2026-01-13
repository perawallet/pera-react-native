---
description: Create a new React Native component following project conventions
---

# Create Component Workflow

Use this workflow when creating a new UI component.

## Prerequisites

Reference these before starting:
- `.agent/rules/code-patterns.md` - Detailed component patterns with examples
- `docs/FOLDER_STRUCTURE.md` - Where to place the component
- `docs/NAMING_CONVENTIONS.md` - How to name files and the component

## Steps

### 1. Determine Component Location

- **Shared component** → `apps/mobile/src/components/[component-name]/`
- **Module-specific** → `apps/mobile/src/modules/[module]/components/[component-name]/`

### 2. Create Component Directory

```sh
mkdir -p apps/mobile/src/components/[component-name]
```

### 3. Create Component File

Create `[ComponentName].tsx` following the pattern in `.agent/rules/code-patterns.md`:

- Use `PW` prefix for shared components (e.g., `PWButton.tsx`)
- No prefix for module-specific components
- Define props type at the top
- Use functional component with explicit return type
- Export as default

### 4. Create Styles File

Create `styles.ts` following the style pattern in `.agent/rules/code-patterns.md`:

- Use `makeStyles` from `@rneui/themed` for theme access
- Export a `useStyles` hook

### 5. Create Test File (Optional but Recommended)

Create `__tests__/[ComponentName].test.tsx`:

- Import from `@test-utils` for providers
- Test user behavior, not implementation
- Cover key interactions

### 6. Verify

// turbo
```sh
pnpm --filter mobile lint
```

// turbo
```sh
pnpm --filter mobile test
```
