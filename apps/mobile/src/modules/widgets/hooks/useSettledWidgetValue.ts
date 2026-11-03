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

import { useState } from 'react'
import type { Optional } from '@perawallet/wallet-core-shared'

type Settled<T> = { identity: string; key: string; value: T }

export type UseSettledWidgetValueOptions<T> = {
    /** What the value is of (scope, currency, accounts); a change discards the kept value. */
    identity: string
    isError: boolean
    /** What counts as a change; defaults to the whole value. */
    keyOf?: (value: T) => string
}

/**
 * The last good `value` for `identity`, kept through a failed read, and kept by
 * reference while `keyOf` is unchanged so a refetch with the same content
 * neither moves a timestamp nor rewrites the snapshot.
 */
export const useSettledWidgetValue = <T>(
    value: Optional<T>,
    {
        identity,
        isError,
        keyOf = JSON.stringify,
    }: UseSettledWidgetValueOptions<T>,
): Optional<T> => {
    const [settled, setSettled] = useState<Optional<Settled<T>>>(undefined)
    const current = settled?.identity === identity ? settled : undefined

    if (isError) return current ? current.value : value
    if (value === undefined) return undefined
    const key = keyOf(value)
    if (current?.key === key) return current.value
    setSettled({ identity, key, value })
    return value
}
