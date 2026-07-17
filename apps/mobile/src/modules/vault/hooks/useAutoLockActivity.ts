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

import { useEffect, useRef } from 'react'
import { armAutoLock } from '@perawallet/wallet-extension-keystore-chrome'

const THROTTLE_MS = 60_000
const ACTIVITY_EVENTS = ['pointerdown', 'keydown'] as const

type EventTargetLike = {
    addEventListener: (type: string, listener: () => void) => void
    removeEventListener: (type: string, listener: () => void) => void
}

/**
 * Extends the auto-lock sliding window on user activity (M2 only re-armed on
 * surface open, so a long-lived expanded tab could lock mid-use). Throttled:
 * chrome.alarms.create is a cross-process call, once a minute is plenty.
 */
export const useAutoLockActivity = (isUnlocked: boolean): void => {
    const lastArmAt = useRef(0)

    useEffect(() => {
        if (!isUnlocked) return
        const target = globalThis as unknown as EventTargetLike
        const handleActivity = (): void => {
            const now = Date.now()
            if (now - lastArmAt.current < THROTTLE_MS) return
            lastArmAt.current = now
            void armAutoLock()
        }
        for (const event of ACTIVITY_EVENTS) {
            target.addEventListener(event, handleActivity)
        }
        return () => {
            for (const event of ACTIVITY_EVENTS) {
                target.removeEventListener(event, handleActivity)
            }
        }
    }, [isUnlocked])
}
