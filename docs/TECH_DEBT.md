# Technical Debt

This document tracks known areas that need improvement.

**Last Updated:** 2026-01-13

## Categories

### 🔴 Critical / High Priority

- **Deep Link Handlers** — Several deep link types have placeholder implementations
- **Transaction Signing** — Not all Algorand transaction types fully supported
- **Secure Storage `authenticate()`** — Currently returns true without validation

### 🟡 Medium Priority

- **Account Features** — NFT tab, history tab, inbox not implemented
- **Swap Module** — Uses mock data
- **Legacy Mnemonics** — 25-word legacy accounts not yet supported
- **Type Safety** — Some areas use `any` types, especially in tests

### 🟢 Low Priority

- **Asset Icons** — Could add more local icons for popular assets
- **Governor Badges** — Not implemented in account icons
- **Locale/Region** — Hardcoded to en-US in some places

## Finding TODOs

Search for `TODO` comments in the codebase to find specific items:

```sh
grep -r "TODO" apps/mobile/src --include="*.ts" --include="*.tsx"
```

## Addressing Tech Debt

- When working on related code, consider fixing nearby TODOs
- If a TODO would expand scope significantly, note it and move on
- Remove TODO comments when resolved

See the full registry in `docs/TECH_DEBT_FULL.md` for detailed line numbers and code references.
