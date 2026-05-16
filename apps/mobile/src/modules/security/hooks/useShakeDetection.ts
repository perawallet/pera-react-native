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

import { useEffect, useRef } from 'react'
import { Accelerometer } from 'expo-sensors'

type AccelerometerSubscription = ReturnType<typeof Accelerometer.addListener>

// Threshold tuning. thresholdsa are reported in gravities (g).
export const JERK_THRESHOLD_G = 2.5
export const SHAKE_THRESHOLD_G = 1.7
export const SHAKE_REVERSALS_REQUIRED = 3
export const SHAKE_WINDOW_MS = 1000
export const COOLDOWN_MS = 2000
export const SAMPLE_INTERVAL_MS = 16 // ~60Hz

type AccelerometerSample = {
    x: number
    y: number
    z: number
}

type ReversalEntry = {
    timestamp: number
    sign: -1 | 1
    magnitude: number
}

type UseShakeDetectionArgs = {
    enabled: boolean
    onTrigger: () => void
}

const magnitudeOf = ({ x, y, z }: AccelerometerSample): number =>
    Math.sqrt(x * x + y * y + z * z)

const signOf = (value: number): -1 | 1 => (value >= 0 ? 1 : -1)

/**
 * Pure detector hook over `expo-sensors` Accelerometer. Subscribes when
 * `enabled` and detects either a sharp jerk (instantaneous magnitude above
 * `JERK_THRESHOLD_G`) or a sustained shake (>=3 sign reversals on any
 * single axis within a 1s window, with peak magnitude above
 * `SHAKE_THRESHOLD_G`). After a trigger, suppresses further triggers for
 * `COOLDOWN_MS` to avoid bouncing.
 *
 * The hook is intentionally headless and has no opinion on what to lock —
 * the host wires `onTrigger` to whatever lock primitive is appropriate.
 */
export const useShakeDetection = ({
    enabled,
    onTrigger,
}: UseShakeDetectionArgs): void => {
    const onTriggerRef = useRef(onTrigger)
    onTriggerRef.current = onTrigger

    useEffect(() => {
        if (!enabled) return

        let subscription: AccelerometerSubscription | null = null
        let cancelled = false
        let lastTriggerAt = 0
        const reversalsByAxis: Record<'x' | 'y' | 'z', ReversalEntry[]> = {
            x: [],
            y: [],
            z: [],
        }
        const previousSignByAxis: Record<'x' | 'y' | 'z', -1 | 1 | null> = {
            x: null,
            y: null,
            z: null,
        }

        const handleSample = (sample: AccelerometerSample) => {
            const now = Date.now()
            if (now - lastTriggerAt < COOLDOWN_MS) return

            const magnitude = magnitudeOf(sample)

            // Jerk path — single sample over threshold. Fires immediately.
            if (magnitude >= JERK_THRESHOLD_G) {
                lastTriggerAt = now
                onTriggerRef.current()
                return
            }

            // Shake path — count sign reversals on each axis within a sliding
            // window. Reversal = sign of the axis component flips between
            // consecutive samples while the overall magnitude is non-trivial.
            // A small magnitude floor avoids counting near-zero jitter as
            // reversals when the device is at rest.
            ;(['x', 'y', 'z'] as const).forEach(axis => {
                const component = sample[axis]
                const prev = previousSignByAxis[axis]
                const next = signOf(component)
                previousSignByAxis[axis] = next

                if (prev === null || prev === next) return
                if (magnitude < SHAKE_THRESHOLD_G) return

                const entries = reversalsByAxis[axis]
                entries.push({ timestamp: now, sign: next, magnitude })
                // Drop anything outside the sliding window.
                while (
                    entries.length > 0 &&
                    now - entries[0].timestamp > SHAKE_WINDOW_MS
                ) {
                    entries.shift()
                }

                if (entries.length >= SHAKE_REVERSALS_REQUIRED) {
                    lastTriggerAt = now
                    // Clear all axis windows so a single shake gesture fires
                    // exactly once, not once per axis crossing the threshold.
                    reversalsByAxis.x.length = 0
                    reversalsByAxis.y.length = 0
                    reversalsByAxis.z.length = 0
                    onTriggerRef.current()
                }
            })
        }

        ;(async () => {
            try {
                // isAvailableAsync returns false on simulators and on devices
                // where the sensor is disabled at the OS level. We still
                // attempt to subscribe in case the implementation lies — the
                // listener will simply never fire, which is the right
                // failure mode (no false triggers).
                const available = await Accelerometer.isAvailableAsync()
                if (cancelled) return
                if (!available) return
                Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS)
                subscription = Accelerometer.addListener(handleSample)
            } catch {
                // Sensor unavailable / permission revoked / not installed.
                // No-op so the toggle remains user-flippable without ever
                // surfacing an error in the UI.
            }
        })()

        return () => {
            cancelled = true
            subscription?.remove()
            subscription = null
        }
    }, [enabled])
}
