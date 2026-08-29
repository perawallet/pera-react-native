# Style Guide

The enforced rules and their examples live in `CLAUDE.md`, which every agent session loads. This page
covers the decisions behind them and the few things `CLAUDE.md` doesn't carry.

## The rules in one breath

TypeScript strict mode stays on; reach for `unknown` and a type guard rather than `any`; give
exported functions explicit return types. Components are functions, styled with `makeStyles` from
`@rneui/themed` and theme tokens only. Every external component is wrapped in a `PW*` before use.
React Query for anything async, Zustand for local state. Complex logic comes out of the component
body into a colocated `use[ComponentName]` hook.

Hook return types must be dependency-agnostic. Never hand a caller a `UseQueryResult`,
`UseMutationResult` or `StoreApi`; declare your own `Use[Name]QueryResult` so the library underneath
can be swapped without touching call sites.

## Why RNE

We keep React Native Elements as the primary UI and styling library. Unistyles and NativeWind were
both considered.

The deciding factor is that RNE ships complex components (bottom sheets, tabs, accordions) and the
alternatives are pure styling engines. Moving to one would mean building and maintaining those
ourselves, which is a maintenance bill we would be paying forever for a nicer styling API.

## Comments

Code says what. Comments say why, and only when the why isn't obvious. Default to none.

Worth a comment: non-obvious rationale, a trap or workaround, units and encodings the type can't
express.

Not worth a comment: restating the code, JSDoc repeating the signature, section banners, "this hook
does X" above `useX`, change-log narration, commented-out code.

One line is the norm and three is a lot. Longer explanations belong in `docs/`.

## Images

SVG for icons, logos and anything that has to scale. WebP for photos, complex images and
screenshots.

## Before pushing

```sh
pnpm pre-push   # Lint, format, copyright, i18n
pnpm test       # Run tests
```

If those fail, `pnpm lint:fix` handles lint and type-aware issues and `pnpm format` handles
formatting.

## Learn more

- [Architecture](ARCHITECTURE.md) for where logic goes versus UI
- [Code Layout](CODE_LAYOUT.md) for where files go and what to call them
