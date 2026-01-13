# Performance Profiling & Optimization

This guide outlines the tools and techniques for profiling and optimizing the Pera Mobile application.

## Profiling Tools

### 1. In-App Performance Monitor

React Native comes with a built-in lightweight performance overlay.

**Access:** Open the Developer Menu (`Cmd+D` on iOS Simulator, `Cmd+M` on Android Emulator) → **Show Perf Monitor**

**Metrics:**
| Metric | Description | Target |
|--------|-------------|--------|
| RAM | Memory usage | Monitor for leaks |
| JSC/Hermes | JavaScript heap usage | Keep low |
| Views | Count of native views | Minimize |
| UI FPS | Native UI thread | 60fps |
| JS FPS | JavaScript thread | 60fps |

### 2. React DevTools Profiler

Use React DevTools to profile render performance.

**Setup:**

```sh
pnpm start
# Press 'j' in the Metro terminal to open the debugger
# Navigate to the Profiler tab
```

**What to look for:**

- Unnecessary re-renders
- "Expensive" components (long render time)
- Components rendering when they shouldn't

### 3. JavaScript Profiler (Hermes)

Since we use the Hermes engine, you can profile JS execution directly:

1. Open the debugger (`j` key in terminal)
2. Go to the **Performance** tab in Chrome DevTools
3. Record a session while interacting with the app
4. Analyze the flame graph to find slow functions

### 4. Native Profiling

For deep debugging (native UI thread, memory leaks, battery):

| Platform | Tool                    | Access                         |
| -------- | ----------------------- | ------------------------------ |
| iOS      | Xcode Instruments       | Product → Profile (Cmd+I)      |
| Android  | Android Studio Profiler | View → Tool Windows → Profiler |

### 5. Why Did You Render?

We have `@welldone-software/why-did-you-render` available for tracking re-renders:

**Enable:**

```typescript
// Set in config
config.profilingEnabled = true
```

**Track a component:**

```typescript
const MyComponent = (props) => {
    return <View>...</View>
}

MyComponent.whyDidYouRender = true
export default MyComponent
```

Check the console for "Re-render caused by..." messages.

---

## Optimization Best Practices

### 1. State Management Optimization

**Select only what you need from stores:**

```typescript
// ✅ GOOD: Minimal re-renders
const balance = useAccountStore(state => state.balance)
const selectedAddress = useAccountStore(state => state.selectedAccountAddress)

// ❌ BAD: Re-renders on ANY store change
const { balance, selectedAddress, accounts } = useAccountStore()
const store = useAccountStore()
```

**Use shallow comparison for objects:**

```typescript
import { shallow } from 'zustand/shallow'

// ✅ GOOD: Only re-renders if these specific values change
const { accounts, selectedAccountAddress } = useAccountStore(
    state => ({
        accounts: state.accounts,
        selectedAccountAddress: state.selectedAccountAddress,
    }),
    shallow,
)
```

### 2. List Performance

We use `FlashList` from `@shopify/flash-list` for performant lists:

```typescript
import { FlashList } from '@shopify/flash-list'

// ✅ GOOD
<FlashList
    data={items}
    renderItem={renderItem}
    estimatedItemSize={72}  // Accurate size improves performance
    keyExtractor={item => item.id}
/>

// ❌ BAD
<FlatList  // Use FlashList for long lists
    data={items}
    renderItem={renderItem}
/>
```

**FlashList Best Practices:**

- Provide accurate `estimatedItemSize`
- Keep list items simple (avoid deep nesting)
- Memoize list items

### 3. Memoization

**Memoize expensive calculations:**

```typescript
// ✅ GOOD
const expensiveResult = useMemo(() => {
    return items
        .filter(item => item.active)
        .sort((a, b) => b.balance - a.balance)
}, [items])

// ❌ BAD: Recalculates on every render
const expensiveResult = items
    .filter(item => item.active)
    .sort((a, b) => b.balance - a.balance)
```

**Stable callbacks for child components:**

```typescript
// ✅ GOOD: Stable reference
const handlePress = useCallback(() => {
    doSomething(id)
}, [id])

return <MemoizedChild onPress={handlePress} />

// ❌ BAD: New function on every render
return <MemoizedChild onPress={() => doSomething(id)} />
```

**Memoize components that receive callbacks:**

```typescript
// ✅ GOOD
const AccountCard = memo(({ account, onPress }) => {
    return <TouchableOpacity onPress={onPress}>...</TouchableOpacity>
})

// Parent
const handlePress = useCallback((id) => navigate(id), [navigate])
accounts.map(acc => <AccountCard key={acc.id} account={acc} onPress={() => handlePress(acc.id)} />)
```

### 4. Animation Performance

**Use Reanimated for smooth animations:**

```typescript
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated'

const offset = useSharedValue(0)

const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
}))

// Runs on UI thread - 120fps capable
const handlePress = () => {
    offset.value = withSpring(100)
}
```

**Avoid:**

- `Animated` from `react-native` for complex animations
- JavaScript-driven animations for frequent updates
- Layout animations on complex views

### 5. Image Optimization

```typescript
// ✅ GOOD
<Image
    source={{ uri: imageUrl }}
    style={{ width: 100, height: 100 }}  // Fixed dimensions
    resizeMode="cover"
/>

// ❌ BAD: Unbounded/dynamic sizing
<Image
    source={{ uri: imageUrl }}
    style={{ flex: 1 }}  // Expensive layout calculations
/>
```

**Best practices:**

- Use WebP format when possible
- Provide explicit dimensions
- Use proper `resizeMode`
- Consider caching libraries for remote images

---

## Common Performance Pitfalls

### 1. Console Logs

```typescript
// ❌ BAD: Synchronous and slow
console.log('Large object:', hugeObject)

// ✅ GOOD: Use Logger with level control
logger.debug('Large object', { id: hugeObject.id })
```

Remove or guard debug logs in production paths.

### 2. Anonymous Functions in JSX

```typescript
// ❌ BAD: New function on every render
<MemoizedComponent onPress={() => handlePress(id)} />

// ✅ GOOD: Stable reference with useCallback
const onPress = useCallback(() => handlePress(id), [id])
<MemoizedComponent onPress={onPress} />
```

### 3. Bridge Traffic

Minimize passing large JSON objects across the JS-Native bridge:

```typescript
// ❌ BAD: Large data across bridge on every render
<NativeComponent data={hugeDataObject} />

// ✅ GOOD: Pass minimal data, fetch on native side if needed
<NativeComponent dataId={objectId} />
```

### 4. Inline Styles

```typescript
// ❌ BAD: New object on every render
<View style={{ padding: 16, backgroundColor: theme.colors.background }}>

// ✅ GOOD: StyleSheet or memoized styles
<View style={styles.container}>
```

### 5. Unnecessary Re-renders in Lists

```typescript
// ❌ BAD: Entire list re-renders when one item changes
const ListItem = ({ item, selectedId }) => {
    const isSelected = item.id === selectedId  // All items re-render when selectedId changes
}

// ✅ GOOD: Selector in parent, boolean prop to child
const MemoizedListItem = memo(({ item, isSelected }) => { ... })

// Parent
{items.map(item => (
    <MemoizedListItem
        key={item.id}
        item={item}
        isSelected={item.id === selectedId}
    />
))}
```

---

## Performance Monitoring Checklist

Before shipping:

- [ ] No console.log in hot paths
- [ ] Lists use FlashList
- [ ] Heavy computations use useMemo
- [ ] Callbacks passed to children use useCallback
- [ ] Animations use Reanimated (not Animated)
- [ ] Images have fixed dimensions
- [ ] Zustand selectors are granular
- [ ] No inline styles in frequently rendered components

---

## Debugging Performance Issues

### Step 1: Identify the Problem

1. Open Perf Monitor
2. Look for FPS drops below 60
3. Note which interactions cause drops

### Step 2: Profile

1. Open React DevTools Profiler
2. Record the problematic interaction
3. Look for:
    - Long render times
    - Unnecessary re-renders
    - Deep component trees

### Step 3: Fix

Common fixes:

- Add `memo()` to components
- Add `useMemo()`/`useCallback()` to expensive operations
- Use granular Zustand selectors
- Move state closer to where it's used
- Virtualize long lists

### Step 4: Verify

1. Re-profile after fix
2. Confirm FPS is stable at 60
3. Check that memory usage is stable (no leaks)
