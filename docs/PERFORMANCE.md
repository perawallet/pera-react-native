# Performance Guidelines

A smooth, responsive app is essential for a good user experience.

## Key Targets

| Metric            | Target      |
| ----------------- | ----------- |
| UI FPS            | 60fps       |
| JS FPS            | 60fps       |
| App launch        | < 2 seconds |
| Screen transition | < 300ms     |

## Quick Wins

### 1. Use FlashList for Long Lists

```jsx
import { FlashList } from '@shopify/flash-list'

;<FlashList
    data={items}
    renderItem={renderItem}
    estimatedItemSize={72}
/>
```

### 2. Use Granular Store Selectors

```typescript
// ✅ Good - only re-renders when balance changes
const balance = useStore(state => state.balance)

// ❌ Bad - re-renders on any store change
const { balance } = useStore()
```

### 3. Memoize Expensive Operations

```typescript
const sorted = useMemo(() => items.sort((a, b) => b.value - a.value), [items])
```

### 4. Use Reanimated for Animations

JavaScript thread should stay free. Run animations on the UI thread with Reanimated.

## Debugging Performance

1. Enable the **Perf Monitor** (Cmd+D → Show Perf Monitor)
2. Open **React DevTools Profiler** to find slow components
3. Look for unnecessary re-renders

## Common Pitfalls

- Console.log in render paths
- Inline styles (create new objects each render)
- Anonymous functions in JSX
- Large objects passed over the bridge

For detailed patterns, see the development workflows.
