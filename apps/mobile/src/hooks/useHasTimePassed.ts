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

import { useEffect, useState } from 'react'
import type { Optional } from '@perawallet/wallet-core-shared'

// setTimeout fires at once for any delay above 2^31 - 1 ms (about 24.8 days).
const MAX_TIMEOUT_MS = 2_147_483_647

/** Whether the clock is past `atMs` (Unix ms), flipping while mounted; always false without a time. */
export const useHasTimePassed = (atMs: Optional<number>): boolean => {
    const [hasPassed, setHasPassed] = useState(
        () => atMs !== undefined && Date.now() >= atMs,
    )

    useEffect(() => {
        if (atMs === undefined) {
            setHasPassed(false)
            return
        }
        let timer: Optional<ReturnType<typeof setTimeout>>
        const check = () => {
            const remaining = atMs - Date.now()
            setHasPassed(remaining <= 0)
            if (remaining > 0) {
                timer = setTimeout(check, Math.min(remaining, MAX_TIMEOUT_MS))
            }
        }
        check()
        return () => clearTimeout(timer)
    }, [atMs])

    return hasPassed
}
