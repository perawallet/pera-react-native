# monotonic-clock

Local Expo module implementing the `PeraMonotonicClock` native module behind
`RNMonotonicClockService` (`extensions/platform-react-native/src/services/monotonic-clock.ts`).
Autolinked via `expo.autolinking.nativeModulesDir`, with no config plugin or
manual registration.

The PIN lockout (`packages/security/src/lockout.ts`) stores its deadline on this
clock so that moving the device clock forward can't end it early.

## Payload contract

`now()` is synchronous and returns `{ bootId: string, elapsedMs: number }`.

The lockout relies on two properties. Changing either breaks it silently:

- `elapsedMs` keeps counting while the device sleeps. A clock that pauses in
  sleep (`mach_absolute_time`, `uptimeMillis`) would stretch a 30 s lockout
  over however long the screen stays off.
- `bootId` changes on every reboot, since `elapsedMs` restarts from zero. A
  deadline is only compared against a reading with the same `bootId`.

## Sources

| Platform | `elapsedMs`                                     | `bootId`                               |
| -------- | ----------------------------------------------- | -------------------------------------- |
| Android  | `SystemClock.elapsedRealtime()`                 | `Settings.Global.BOOT_COUNT`           |
| iOS      | `mach_continuous_time()` × `mach_timebase_info` | `sysctlbyname("kern.bootsessionuuid")` |

When the boot id is unreadable, both fall back to the boot time derived from the
wall clock (`boottime:<seconds>`), read once per process. That value shifts when
the clock is stepped, so a later process sees a different boot and restarts the
lockout window, which fails closed. If iOS can read neither sysctl, `now()`
throws and the JS side falls back to the wall clock.
