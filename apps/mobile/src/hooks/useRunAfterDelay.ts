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

import { useCallback, useEffect, useRef } from 'react'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseRunAfterDelayResult = {
    schedule: (callback: () => void, delayMs: number) => void
    flush: () => void
    cancel: () => void
}

export const useRunAfterDelay = (): UseRunAfterDelayResult => {
    const timerRef = useRef<Nullable<ReturnType<typeof setTimeout>>>(null)
    const callbackRef = useRef<Nullable<() => void>>(null)

    const cancel = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
        }
        timerRef.current = null
        callbackRef.current = null
    }, [])

    const flush = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
        }
        timerRef.current = null
        const callback = callbackRef.current
        callbackRef.current = null
        callback?.()
    }, [])

    const schedule = useCallback((callback: () => void, delayMs: number) => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
        }
        callbackRef.current = callback
        timerRef.current = setTimeout(() => {
            timerRef.current = null
            const pending = callbackRef.current
            callbackRef.current = null
            pending?.()
        }, delayMs)
    }, [])

    useEffect(() => cancel, [cancel])

    return { schedule, flush, cancel }
}
