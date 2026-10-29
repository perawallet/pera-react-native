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

import { useState, useCallback } from 'react'
import type { NumpadKey } from '@components/core'
import { PIN_LENGTH } from '@perawallet/wallet-core-security'

const COMPLETION_DELAY = 100

type UsePinEntryParams = {
    onPinComplete: (pin: string) => void
    onPinChange?: (pin: string) => void
    onErrorAnimationComplete?: () => void
    /** Must match the circle count the caller renders. */
    length?: number
    /** A new value starts a new step, so the digits entered so far are dropped. */
    resetKey?: string
}

type UsePinEntryResult = {
    pin: string
    handleKeyPress: (key: NumpadKey) => void
    clearPin: () => void
}

export const usePinEntry = ({
    onPinComplete,
    onPinChange,
    length = PIN_LENGTH,
    resetKey,
}: UsePinEntryParams): UsePinEntryResult => {
    const [pin, setPin] = useState('')
    // Reset during render, not in an effect: a mount effect can flush after the
    // first tap and wipe that digit, so the PIN never completes.
    const [entryKey, setEntryKey] = useState(resetKey)
    if (entryKey !== resetKey) {
        setEntryKey(resetKey)
        setPin('')
    }

    const clearPin = useCallback(() => {
        setPin('')
    }, [])

    const handleKeyPress = useCallback(
        (key: NumpadKey) => {
            if (key === 'delete') {
                setPin(prev => {
                    const newPin = prev.slice(0, -1)
                    onPinChange?.(newPin)
                    return newPin
                })
                return
            }

            setPin(prev => {
                if (prev.length >= length) return prev

                const newPin = prev + key
                onPinChange?.(newPin)

                if (newPin.length === length) {
                    setTimeout(() => {
                        onPinComplete(newPin)
                    }, COMPLETION_DELAY)
                }

                return newPin
            })
        },
        [onPinComplete, onPinChange, length],
    )

    return {
        pin,
        handleKeyPress,
        clearPin,
    }
}
