---
description: Create a new React Native component following Pera conventions
---

# Create Component

## Steps

### 1. Check for External Dependencies

**If wrapping an external component** (RNE, React Native, third-party):

- Use `PW` prefix (e.g., `PWButton`, `PWText`)
- Place in `apps/mobile/src/components/core/PW[Name]/`
- Define a clean, project-specific props interface
- Do NOT re-export all props from the external component

**If NOT wrapping an external component**: proceed to step 2.

### 2. Determine Location

| Type                 | Location                                              |
| -------------------- | ----------------------------------------------------- |
| Design system (PW\*) | `apps/mobile/src/components/core/[Name]/`             |
| Shared component     | `apps/mobile/src/components/[Name]/`                  |
| Module-specific      | `apps/mobile/src/modules/[module]/components/[Name]/` |

Folder names use **PascalCase** matching the component name.

### 3. Create Directory

```sh
mkdir -p [location]/[ComponentName]/__tests__
```

### 4. Create Component File (`[ComponentName].tsx`)

- Use `PW` prefix for shared/core components
- No prefix for module-specific components
- Define props type at the top
- Named export (no default export)

See `references/patterns.md` for full wrapper examples.

### 5. Create Styles File (`styles.ts`)

- Use `makeStyles` from `@rneui/themed` (NEVER `StyleSheet.create`)
- Export a `useStyles` hook
- Define `StyleProps` type if styles depend on props

See `references/patterns.md` for styles with props example.

### 6. Create Barrel File (`index.ts`)

```typescript
export { ComponentName } from './ComponentName'
export type { ComponentNameProps } from './ComponentName'
```

### 6b. Update Core Barrel (if applicable)

If creating a core component, add export to `apps/mobile/src/components/core/index.ts`.

### 7. Create Test File (`__tests__/[ComponentName].spec.tsx`)

**Whether you write a unit test depends on where the component lives:**

| Location                                           | Write a unit test?                                                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/src/components/core/PW*/`             | **Yes** — behavioral tests + smoke test welcome.                                                                                  |
| `apps/mobile/src/components/[Name]/`               | **Yes** — same rules.                                                                                                             |
| `apps/mobile/src/modules/[mod]/components/[Name]/` | **No.** Integration tests cover module screens. If the component has non-trivial logic, extract a `use[Name]` hook and test that. |

For core/shared components:

- Import from `@test-utils/render`
- Test **interactions, prop wiring, conditional rendering, and formatting** — not static text or styles
- Avoid render-only tests with no real assertion (`expect(container).toBeTruthy()`)
- One smoke test per file is fine; don't repeat it with prop variations that don't change observable behavior

See `references/testing.md` for templates and `docs/TESTING.md` for the full policy.

### 8. Add any necessary internationalization strings

- Add to `apps/mobile/src/i18n/locales/en.json`

### 8. Subcomponents (if needed)

- Create in the same folder as the main component
- Do NOT re-export in `index.ts`
- Only used by the parent component

### 9. Verify

```sh
pnpm pre-push --no-fail-on-error
pnpm test
```
