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

import { useCallback, useRef, useState } from 'react'

export type UseSingleFlightResult<TKey> = {
    isPending: boolean
    pendingKey: TKey | undefined
    /** Resolves `undefined`, without running `work`, while a call is running. */
    run: <T>(work: () => Promise<T>, key?: TKey) => Promise<T | undefined>
}

export const useSingleFlight = <
    TKey = never,
>(): UseSingleFlightResult<TKey> => {
    const [pending, setPending] = useState<{ key?: TKey }>()
    // State lands a render late, so a second tap in the same frame still sees
    // it unset; the ref is what drops re-entry.
    const isRunningRef = useRef(false)

    const run = useCallback(async <T>(work: () => Promise<T>, key?: TKey) => {
        if (isRunningRef.current) return undefined
        isRunningRef.current = true
        setPending({ key })
        try {
            return await work()
        } finally {
            isRunningRef.current = false
            setPending(undefined)
        }
    }, [])

    return { isPending: pending !== undefined, pendingKey: pending?.key, run }
}
