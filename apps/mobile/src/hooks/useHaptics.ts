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

import { useMemo, useRef } from 'react'
// oxlint-disable-next-line no-restricted-imports -- the one sanctioned haptics import
import * as Haptics from 'expo-haptics'
import { routeCapabilities } from '@routes/capabilities'
import { isHapticFeedbackEnabled } from './useHapticFeedbackSetting'

export type UseHapticsResult = {
    success: () => void
    error: () => void
    warning: () => void
    selection: () => void
    light: () => void
    medium: () => void
    heavy: () => void
    txSuccess: () => void
    txError: () => void
    copy: () => void
    scanLock: () => void
    pinDigit: () => void
    pinError: () => void
    chartTick: () => void
}

/** Minimum milliseconds between two `chartTick` haptics from one hook instance. */
export const CHART_TICK_INTERVAL_MS = 50

// Unsupported hardware rejects (UnavailabilityError, no vibrator); feedback is
// optional, so the failure is swallowed without logging.
const play = (effect: () => Promise<void>): void => {
    try {
        effect().catch(() => undefined)
    } catch {
        // A synchronous throw from a missing native module is equally ignorable.
    }
}

// Read per call, not per render: subscribing here would re-render every
// consumer (list rows included) on any preference write, and a toggle still
// takes effect on the very next haptic.
const isActive = (): boolean =>
    routeCapabilities.hapticFeedback && isHapticFeedbackEnabled()

export const useHaptics = (): UseHapticsResult => {
    const lastChartTickAt = useRef(0)

    return useMemo(() => {
        const notify = (type: Haptics.NotificationFeedbackType) => (): void => {
            if (isActive()) play(() => Haptics.notificationAsync(type))
        }
        const impact = (style: Haptics.ImpactFeedbackStyle) => (): void => {
            if (isActive()) play(() => Haptics.impactAsync(style))
        }
        const selection = (): void => {
            if (isActive()) play(() => Haptics.selectionAsync())
        }

        return {
            success: notify(Haptics.NotificationFeedbackType.Success),
            error: notify(Haptics.NotificationFeedbackType.Error),
            warning: notify(Haptics.NotificationFeedbackType.Warning),
            selection,
            light: impact(Haptics.ImpactFeedbackStyle.Light),
            medium: impact(Haptics.ImpactFeedbackStyle.Medium),
            heavy: impact(Haptics.ImpactFeedbackStyle.Heavy),
            txSuccess: notify(Haptics.NotificationFeedbackType.Success),
            txError: notify(Haptics.NotificationFeedbackType.Error),
            copy: impact(Haptics.ImpactFeedbackStyle.Light),
            scanLock: impact(Haptics.ImpactFeedbackStyle.Medium),
            pinDigit: selection,
            pinError: notify(Haptics.NotificationFeedbackType.Error),
            chartTick: () => {
                const now = Date.now()
                if (now - lastChartTickAt.current < CHART_TICK_INTERVAL_MS)
                    return
                lastChartTickAt.current = now
                selection()
            },
        }
    }, [])
}
