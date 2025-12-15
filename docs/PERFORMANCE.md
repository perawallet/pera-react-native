# Performance Profiling & Optimization

This guide outlines the tools and techniques for profiling and optimizing the Pera Mobile application.

## 🛠 Profiling Tools

### 1. In-App Performance Monitor
React Native comes with a built-in lightweight performance overlay.
- **Access**: Open the Developer Menu (`Cmd+D` on iOS Simulator, `Cmd+M` on Android Emulator) -> **Show Perf Monitor**.
- **Metrics**:
  - **RAM**: Memory usage.
  - **JSC/Hermes**: JavaScript heap usage.
  - **Views**: Count of native views (keep this low!).
  - **UI/JS FPS**: Frame rates. Drops below 60fps indicate jank.

### 2. React DevTools (Components & Profiler)
Use React DevTools to inspect the component hierarchy and profile render performance.

**Setup**:
1. Start your app: `pnpm start`
2. Press `j` in the Metro terminal to open the debugger (opens in Chrome/Edge).
3. Navigate to the **Components** or **Profiler** tab.

**Why use it?**
- Identify **unnecessary re-renders**.
- See which components are "expensive" to render.
- Highlight updates in real-time.

### 3. JavaScript Profiler (Hermes)
Since we use the Hermes engine, you can profile JS execution directly in the browser DevTools.
1. Open the debugger (`j` key in terminal).
2. Go to the **Performance** tab in Chrome DevTools.
3. Record a session while interacting with the app.
4. Analyze the flame graph to find slow functions.

### 4. Native Profiling
For deep debugging (native UI thread, memory leaks, battery):
- **iOS**: Use **Xcode Instruments** (Time Profiler, Allocations).
  - *Product* -> *Profile* (Cmd+I) in Xcode.
- **Android**: Use **Android Studio Profiler** (CPU, Memory, Energy).

### 5. Why Did You Render? (WDYR)
We have enabled `@welldone-software/why-did-you-render`- to enable it set the config.profilingEnabled flag to true
To track a component's re-renders, add `whyDidYouRender` static property:

```typescript
const MyComponent = (props) => {
  return <View>...</View>
}

MyComponent.whyDidYouRender = true
export default MyComponent
```

Check the console logs for "Re-render caused by..." messages.

---

## ⚡️ Optimization Best Practices

### 1. List Performance (@shopify/flash-list)
We use `FlashList` instead of `FlatList` for critical lists.
- **Estimated Item Size**: Ideally provide accurate `estimatedItemSize`.
- **Light components**: Keep list items simple.

### 2. Render Optimization
- **Memoize expensive calculations**: Use `useMemo` for expensive calculations or frequently re-rendered components.
- **Stable callbacks**: Use `useCallback` for functions passed as props to avoid breaking `React.memo` in children.
- **Selector Optimization**: When using Zustand, select *only* the data you need:
  ```typescript
  // ✅ GOOD
  const balance = useAccountStore(state => state.balance);

  // ❌ BAD (Triggers re-render for ANY store change)
  const { balance } = useAccountStore();
  ```

### 3. Animation Performance
- Use `react-native-reanimated` for 120fps animations.
- Run animations on the UI thread (worklets).
- Avoid `Animated` from `react-native` unless for simple layout transitions.

### 4. Image Optimization
- Use webp/png formats optimized for mobile.
- Use proper `resizeMode` and dimensions.

## 🚨 Common Performance Pitfalls
- **Console Logs**: Remove deep object logging in production paths. `console.log` is synchronous and slow.
- **Anonymous Functions**: Avoid defining functions inside `render` or `return` if passing to memoized components.
- **Bridge Traffic**: Minimize passes of large JSON objects across the JS-Native bridge.
