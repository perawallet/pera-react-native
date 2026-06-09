/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useCallback, useEffect, useState } from 'react'

export type UseCountdownResult = {
    /** Seconds left; counts down to zero once per second, then stops. */
    secondsRemaining: number
    /** `true` while the countdown is still running (`secondsRemaining > 0`). */
    isActive: boolean
    /** Restart from `seconds` (defaults to the initial value). */
    restart: (seconds?: number) => void
}

/**
 * Counts `initialSeconds` down to zero, ticking once per second, then stops.
 * Auto-starts on mount, re-arms whenever `restart` is called, and clears its
 * interval on unmount.
 */
export const useCountdown = (initialSeconds: number): UseCountdownResult => {
    const [secondsRemaining, setSecondsRemaining] = useState(initialSeconds)
    const isActive = secondsRemaining > 0

    // One interval per active run: it ticks down to zero, then `isActive` flips
    // to false and the effect cleanup clears it. `restart` sets a positive value
    // again, which re-arms a fresh interval. Keying on `isActive` (not the
    // changing seconds) avoids tearing down and recreating the interval each tick.
    useEffect(() => {
        if (!isActive) return
        const interval = setInterval(() => {
            setSecondsRemaining(prev => Math.max(prev - 1, 0))
        }, 1000)
        return () => clearInterval(interval)
    }, [isActive])

    const restart = useCallback(
        (seconds: number = initialSeconds) => {
            setSecondsRemaining(seconds)
        },
        [initialSeconds],
    )

    return { secondsRemaining, isActive, restart }
}
