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

import { useCallback, useMemo, useRef, useState } from 'react'
import { Decimal } from 'decimal.js'
import type { Maybe } from '@perawallet/wallet-core-shared'

type UseNumberPadAmountParams = {
    /** Max fraction digits; 0 blocks the decimal separator entirely. */
    decimals: number
}

type UseNumberPadAmountResult = {
    /** Raw typed amount string, or null/undefined when empty. */
    amount: Maybe<string>
    /** Typed amount as a Decimal (0 when empty). */
    amountDecimal: Decimal
    /** NumberPad key handler (undefined key = backspace). */
    handleKey: (key?: string) => void
    /** Imperatively replace the amount (e.g. reset on asset switch). */
    setAmount: (next: Maybe<string>) => void
}

/**
 * Amount-entry state for the {@link NumberPad}: guards decimal input (single
 * separator, leading zero, fraction capped at `decimals`) and exposes the
 * typed value both raw and as a Decimal. Shared by the card amount screens so
 * the guard logic lives in one place.
 */
export const useNumberPadAmount = ({
    decimals,
}: UseNumberPadAmountParams): UseNumberPadAmountResult => {
    const [value, setValue] = useState<Maybe<string>>(undefined)
    // Ref keeps handleKey stable against rapid successive key presses.
    const valueRef = useRef<Maybe<string>>(value)
    const setAmount = useCallback((next: Maybe<string>) => {
        valueRef.current = next
        setValue(next)
    }, [])

    const handleKey = useCallback(
        (key?: string) => {
            const current = valueRef.current ?? null
            if (key) {
                if (key === '.' && decimals === 0) return
                if (key === '.' && (current ?? '').includes('.')) return
                if (key === '.' && !current) {
                    setAmount('0.')
                    return
                }
                const next = (current ?? '') + key
                const decimalIndex = next.indexOf('.')
                if (
                    decimalIndex !== -1 &&
                    next.length - decimalIndex - 1 > decimals
                ) {
                    return
                }
                setAmount(next)
            } else if (current?.length) {
                const next = current.substring(0, current.length - 1)
                setAmount(next.length ? next : null)
            }
        },
        [setAmount, decimals],
    )

    const amountDecimal = useMemo(
        () => (value ? new Decimal(value) : new Decimal(0)),
        [value],
    )

    return { amount: value, amountDecimal, handleKey, setAmount }
}
