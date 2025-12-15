# Pera React Native Architecture Review

## Executive Summary

This review analyzes the Pera React Native monorepo architecture, codebase structure, and development patterns. The application demonstrates a well-structured monorepo with separate workspace packages for business logic, but there are significant opportunities for improvement in testing coverage, code organization, documentation, and development workflows.

---

## 2. Code Quality & Development Patterns

### ✅ Strengths

- **Comprehensive ESLint configuration** with React Native specific rules
- **Consistent copyright headers** enforced via tooling
- **React Query** for server state management with persistence

### ⚠️ Areas for Improvement

#### 2.1 Excessive Technical Debt (TODO Comments)

- **Issue**: 45+ TODO comments found throughout codebase
- **Key examples**:
    - `vitest.config.ts` lines 39-58: Disabled React component testing due to setup issues
    - `bootstrap.ts` line 48: "This is a mess - we should find a more elegant solution here..."
    - Multiple TODOs in components for missing implementations
- **Recommendation**:
    - Create GitHub issues for all TODOs with context
    - Prioritize critical TODOs (bootstrap initialization, test setup)
    - Remove or complete low-priority TODOs

#### 2.5 ESLint Disable Pragmas

- **Issue**: 9 instances of `eslint-disable` comments found
- **Impact**: Bypassing linting rules reduces code quality
- **Recommendation**: Review each instance and either fix the underlying issue or document why the rule should be disabled

---

## 3. Testing Infrastructure

### ✅ Strengths

- **Vitest setup** with coverage thresholds (90% across all metrics)
- **16 test files** with good coverage of deeplink parsing, platform services, and utilities
- **MSW/React Query mocks** available from API generation

### ⚠️ Critical Issues

#### 3.1 React Component Testing Disabled

- **Issue**: Lines 39-42 of `vitest.config.ts` explicitly exclude React components from coverage with a note about setup pain
- **Impact**:
    - Zero test coverage for UI components, screens, and most business logic in the mobile app
    - Only pure TypeScript utility files are tested
    - Actual coverage is much lower than reported
- **Recommendation**:
    - **CRITICAL PRIORITY**: Invest time in fixing `@testing-library/react-native` setup
    - Start with testing simpler presentational components
    - Add integration tests for critical user flows

#### 3.2 Hooks and Bootstrap Excluded From Coverage

- **Issue**: Lines 57-62 exclude critical files (`bootstrap/*`, `hooks/toast.ts`, `hooks/webview.ts`, `hooks/deeplink.ts`) due to "weird syntax errors"
- **Impact**: Core application initialization and custom hooks are untested
- **Recommendation**:
    - Debug and resolve syntax errors (likely ESM/CJS or TypeScript compilation issues)
    - These are high-value test targets

#### 3.3 No E2E Testing

- **Observation**: No Detox, Maestro, or Appium configuration found
- **Impact**: No automated testing of full user flows
- **Recommendation**: Add E2E test framework for critical paths (onboarding, sending funds, WalletConnect)

#### 3.4 Missing Test Documentation

- **Issue**: No documentation on running tests, writing new tests, or testing best practices
- **Recommendation**: Add to README with examples

---

## 4. TypeScript & Type Safety

### ✅ Strengths

- **Modern TypeScript** (v5.9.3) with strict mode from React Native config
- **Path aliases** configured in `tsconfig.json`
- **Type generation** via Kubb for API clients (though noted as reference-only)

### ⚠️ Areas for Improvement

#### 4.1 Inconsistent Type Definitions

- **Issue**: Mix of inline types, `.d.ts` files, and exported types from packages
- **Example**: `theme.d.ts` extends RNE theme but custom types not consistently used
- **Recommendation**:
    - Centralize shared types in `@perawallet/wallet-core-shared`
    - Use consistent type export patterns

#### 4.2 Missing Type Coverage for Navigation

- **Observation**: React Navigation 7 with type-safe routing, but no central navigation types file
- **Recommendation**: Create typed navigation param lists for all routes

#### 4.3 Any Types in Critical Paths

- **Issue**: `deeplink.ts` line 66 has `// eslint-disable-next-line @typescript-eslint/no-explicit-any` for screen params
- **Recommendation**: Define proper types for all screen params and deeplink data

---

## 5. Documentation

### ⚠️ Critical Gaps

#### 5.1 Outdated/Incomplete Mobile README

- **Issues**:
    - Line 11: Known Firebase build issue mentioned but not resolved
    - Line 60: Path aliases noted as broken in deployment
    - Line 47: References non-existent `packages/core/src/index.ts` (should be packages/shared or specific packages)
    - Missing: Component structure guidelines, testing approach, state management patterns
- **Recommendation**: Major README update pass

#### 5.2 Missing Architecture Documentation

- **Gaps**:
    - No ADRs (Architecture Decision Records)
    - No data flow diagrams
    - No explanation of provider hierarchy and dependencies
    - No onboarding guide for new developers
- **Recommendation**: Create `docs/` directory with:
    - `ARCHITECTURE.md` - System overview and data flow
    - `CONTRIBUTING.md` - Development workflow and standards
    - `TESTING.md` - Testing strategy and examples
    - `STATE_MANAGEMENT.md` - When to use Zustand vs React Query vs useState

#### 5.3 Insufficient Package Documentation

- **Issue**: Workspace packages have minimal to no README files
- **Recommendation**: Each package should document its purpose, API, and usage examples

#### 5.4 Missing API Integration Documentation

- **Issue**: Kubb-generated code noted as "reference only" but no clear guidance on how to actually integrate with backends
- **Recommendation**: Document actual API integration patterns and which generated code (if any) is used

---

## 6. Dependency Management

### ✅ Strengths

- **Catalog feature** in pnpm-workspace.yaml for version consistency
- **Workspace protocol** for monorepo package linking

### ⚠️ Areas for Improvement

#### 6.2 React Version

- **Current**: React 19.1.0
- **Concern**: React 19 is cutting edge; React Native ecosystem may not be fully compatible
- **Recommendation**: Verify all React Native libraries support React 19, consider React 18 if compatibility issues arise

#### 6.3 Firebase Build Issue

- **Issue**: README mentions unresolved Firebase build issue on iOS
- **Recommendation**:
    - Investigate and resolve or remove Firebase dependencies
    - Document workaround if keeping

---

## 7. Build & Development Workflow

### ✅ Strengths

- **Turborepo** for monorepo task orchestration
- **Pre-commit hooks** for linting, formatting, and copyright checks
- **Pre-push hooks** for test execution

### ⚠️ Areas for Improvement

#### 7.1 No CI/CD Configuration Visible

- **Observation**: `.github/workflows` exists with 1 file (content not reviewed)
- **Recommendation**: Ensure CI runs:
    - Linting across all packages
    - Tests with coverage enforcement
    - Build validation for iOS and Android
    - Type checking

#### 7.2 Build Configuration Complexity

- **Issue**: Multiple config files (Babel, Metro, Vite, Turbo, tsconfig) with potential conflicts
- **Recommendation**:
    - Document config file hierarchy and responsibilities
    - Audit for redundancy

#### 7.3 API Generation Workflow Unclear

- **Issue**: `generate:all-apis` script exists but when/how to run it is not documented
- **Recommendation**: Document when to regenerate APIs and commit strategy

---

## 8. Navigation & Routing

### ✅ Strengths

- **React Navigation 7** with type-safe static navigation
- **Conditional routing** based on account state (`useHasNoAccounts`)
- **Organized route files** by feature area

### ⚠️ Areas for Improvement

#### 8.1 Route Organization

- **Issue**: Mix of stack definitions across multiple files but no clear index/export pattern
- **Recommendation**: Create routes barrel export for easier imports

#### 8.2 Deep Linking Implementation

- **Positive**: Recent work shows comprehensive deeplink parsing (381 lines in `deeplink.ts`)
- **Concern**: Single large file doing parsing, validation, and navigation
- **Recommendation**: Already has modular parsers - continue refactoring to split concerns

---

## 9. State Management & Data Flow

### ⚠️ Areas for Improvement

#### 9.1 Bootstrap Initialization Complexity

- **Issue**: `bootstrap.ts` line 48 TODO: "This is a mess"
- **Current**: Sequential `initXxxStore()` calls for 8+ stores
- **Recommendation**:
    - Create a store registry with dependency ordering
    - Consider lazy initialization for non-critical stores
    - Add loading states and error handling

#### 9.2 Provider Hierarchy Not Documented

- **Observation**: 6 providers with nested structure in App.tsx and RootComponent
- **Issue**: Unclear why certain providers wrap others
- **Recommendation**: Document provider dependencies and initialization order

#### 9.3 Platform Services Registration

- **Pattern**: Single `firebaseService` instance provides multiple platform services (analytics, crash reporting, notifications, remote config)
- **Issue**: Tight coupling; hard to mock in tests
- **Recommendation**: Consider splitting or documenting why consolidated

---

## 10. Mobile-Specific Concerns

### ⚠️ Areas for Improvement

#### 10.1 Native Module Configuration

- **Issue**: Android/iOS native configs not deeply reviewed but Firebase build issue suggests native dependency problems
- **Recommendation**: Audit native dependencies for conflicts

#### 10.2 Performance Optimization

- **Missing**: No React DevTools, Flipper, or performance monitoring setup documented
- **Recommendation**: Document performance profiling approach

#### 10.3 Accessibility

- **Observation**: No a11y-related code observed
- **Recommendation**: Add accessibility audit and testing

---

## Priority Recommendations

### 🔴 Critical (Do First)

1. **Fix React component testing setup** - Currently 0 coverage on UI components
2. **Resolve bootstrap initialization complexity** - Core app startup is fragile
3. **Fix or remove broken path aliases** - Impacts developer experience
4. **Update mobile README** - Contains outdated/incorrect information
5. **Address 45+ TODO comments** - Convert to tracked issues

### 🟡 High Priority (Do Soon)

6. **Create architecture documentation** - Onboarding and maintenance
7. **Add E2E testing framework** - Critical user flows untested
8. **Fix Firebase build issue** - Or remove if not needed
9. **Standardize state management patterns** - Document when to use which approach
10. **Type safety improvements** - Eliminate `any` types in critical paths

### 🟢 Medium Priority (Planned Work)

11. **React Native version upgrade** - Plan for 0.76+
12. **Component organization refactor** - Clear feature-based structure
13. **Add performance monitoring** - Production observability
14. **CI/CD hardening** - Ensure all checks run automatically
15. **Package documentation** - Each workspace package needs README

---

## Conclusion

The Pera React Native application has a **solid architectural foundation** with good separation of concerns via the monorepo structure. However, there are **significant gaps in testing infrastructure, documentation, and code quality enforcement** that should be addressed to improve maintainability and reliability.

The most critical issue is the **disabled React component testing**, which means the majority of the application is untested despite high reported coverage numbers. Addressing this should be the top priority.

The codebase shows signs of "TODO-driven development" with many deferred decisions and incomplete implementations. Converting these to tracked issues and systematically addressing them will improve code quality.

Overall assessment: **Good architecture, needs execution discipline and testing rigor.**
