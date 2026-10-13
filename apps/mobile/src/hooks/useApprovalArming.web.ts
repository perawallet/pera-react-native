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

import { useEffect, useRef, useState } from 'react'

/** Long enough to outlast a click that began before the window opened. */
export const APPROVAL_ARMING_DELAY_MS = 500

// Input that can only originate inside this document. A click inherited from
// the page that opened the window delivers its mouseup here but none of these:
// its mousedown and any movement happened over the page.
const INTENT_EVENTS = ['pointermove', 'pointerdown', 'keydown'] as const

/**
 * Whether an approval window's primary action may be used yet.
 *
 * A page can open this window with no user gesture and at a fixed, known size,
 * so it can put a decoy exactly where the primary button lands and trigger the
 * request on mousedown — the user's mouseup then presses a button they never
 * saw. Arming requires both a short delay and one input event that provably
 * happened in this window. `keydown` and `pointerdown` count too, so keyboard
 * and touch users are not locked out by a pointer-movement requirement.
 *
 * Losing focus or visibility disarms, and arming starts over once the window
 * is back: a page that hides the window and raises it again under the cursor
 * gets the same treatment as a freshly opened one.
 *
 * The press that arms is itself swallowed: the button remounts on the
 * `disabled` flip, so a touch user's first tap arms and the second acts. The
 * empty selection, not this delay, is what defeats a two-click decoy.
 */
export const useApprovalArming = (): boolean => {
    const [hasDelayElapsed, setHasDelayElapsed] = useState(false)
    const [hasLocalIntent, setHasLocalIntent] = useState(false)
    const [isSuspended, setIsSuspended] = useState(false)
    // Bumped on each resume so the arming effect restarts even when a blur and
    // focus land in the same render batch and `isSuspended` never flips.
    const [armingCycle, setArmingCycle] = useState(0)
    // `focus` also fires for a window that never lost it (e.g. on first load);
    // only a real suspension may restart arming, or it would discard intent.
    const isSuspendedRef = useRef(false)

    useEffect(() => {
        const suspend = () => {
            isSuspendedRef.current = true
            setIsSuspended(true)
            setHasDelayElapsed(false)
            setHasLocalIntent(false)
        }
        const resume = () => {
            if (!isSuspendedRef.current) return
            isSuspendedRef.current = false
            setIsSuspended(false)
            setArmingCycle(cycle => cycle + 1)
        }
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') suspend()
            else resume()
        }
        window.addEventListener('blur', suspend)
        window.addEventListener('focus', resume)
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            window.removeEventListener('blur', suspend)
            window.removeEventListener('focus', resume)
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            )
        }
    }, [])

    useEffect(() => {
        if (isSuspended) return
        const timer = setTimeout(
            () => setHasDelayElapsed(true),
            APPROVAL_ARMING_DELAY_MS,
        )
        const markIntent = () => setHasLocalIntent(true)
        INTENT_EVENTS.forEach(type =>
            window.addEventListener(type, markIntent, { once: true }),
        )

        return () => {
            clearTimeout(timer)
            INTENT_EVENTS.forEach(type =>
                window.removeEventListener(type, markIntent),
            )
        }
    }, [isSuspended, armingCycle])

    return !isSuspended && hasDelayElapsed && hasLocalIntent
}
