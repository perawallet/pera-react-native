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

import { useState, useCallback } from 'react'
import type { NumpadKey } from '@components/core'
import { PIN_LENGTH } from '@perawallet/wallet-core-security'

const COMPLETION_DELAY = 100

type UsePinEntryParams = {
    onPinComplete: (pin: string) => void
    onPinChange?: (pin: string) => void
    onErrorAnimationComplete?: () => void
}

type UsePinEntryResult = {
    pin: string
    handleKeyPress: (key: NumpadKey) => void
    clearPin: () => void
}

export const usePinEntry = ({
    onPinComplete,
    onPinChange,
}: UsePinEntryParams): UsePinEntryResult => {
    const [pin, setPin] = useState('')

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
                if (prev.length >= PIN_LENGTH) return prev

                const newPin = prev + key
                onPinChange?.(newPin)

                if (newPin.length === PIN_LENGTH) {
                    setTimeout(() => {
                        onPinComplete(newPin)
                    }, COMPLETION_DELAY)
                }

                return newPin
            })
        },
        [onPinComplete, onPinChange],
    )

    return {
        pin,
        handleKeyPress,
        clearPin,
    }
}
