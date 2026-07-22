/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

/**
 * How long a hardware signing session survives the app being backgrounded
 * before it is aborted (transport disconnected, machine sent to the
 * `interrupted` error state).
 *
 * 15 s covers the quick app-switches that legitimately happen mid-sign
 * (glancing at an authenticator, tapping a notification). Longer grace
 * buys nothing on iOS — BLE is suspended for backgrounded apps, so the
 * exchange is already frozen — and on Android it only prolongs a session
 * the user has visibly walked away from.
 */
export const HARDWARE_BACKGROUND_GRACE_MS = 15_000

/**
 * Mutable module singleton the hardware machine's backstop guards read.
 *
 * Why a singleton and not machine context: iOS suspends JS timers in the
 * background, so an expired backstop fires the instant the app resumes —
 * potentially BEFORE the AppState 'active' listener gets to run. The
 * listener writes `backgroundedAt` synchronously when the app LEAVES the
 * foreground, so whichever order the wake-up races resolve in, the guard
 * sees a non-null value and swallows the stale timeout.
 */
export const appStateTracker: { backgroundedAt: number | null } = {
    backgroundedAt: null,
}

export type BackgroundResumeAction = 'interrupt' | 'rearm' | 'none'

/**
 * Records an AppState transition and answers what the signing lifecycle
 * should do to running hardware sessions.
 *
 * iOS 'inactive' (app switcher, permission dialogs, control center) is
 * deliberately ignored — the app is still frontmost and BLE keeps running;
 * only a real 'background' arms the policy.
 */
export const recordAppStateChange = (
    nextState: string,
    nowMs: number,
): BackgroundResumeAction => {
    if (nextState === 'background') {
        appStateTracker.backgroundedAt ??= nowMs
        return 'none'
    }
    if (nextState !== 'active') return 'none'

    const backgroundedAt = appStateTracker.backgroundedAt
    if (backgroundedAt === null) return 'none'
    appStateTracker.backgroundedAt = null

    return nowMs - backgroundedAt > HARDWARE_BACKGROUND_GRACE_MS
        ? 'interrupt'
        : 'rearm'
}
