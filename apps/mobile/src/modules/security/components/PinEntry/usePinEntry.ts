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

import { useState, useCallback, useEffect } from 'react'
import type { NumpadKey, PinCircleState } from '@components/core'

type UsePinEntryParams = {
    pinLength: number
    onPinComplete: (pin: string) => void
    onPinChange?: (pin: string) => void
    hasError?: boolean
    onErrorAnimationComplete?: () => void
}

type UsePinEntryResult = {
    pin: string
    circleState: PinCircleState
    handleKeyPress: (key: NumpadKey) => void
    clearPin: () => void
}

export const usePinEntry = ({
    pinLength,
    onPinComplete,
    onPinChange,
    hasError = false,
}: UsePinEntryParams): UsePinEntryResult => {
    const [pin, setPin] = useState('')
    const [circleState, setCircleState] = useState<PinCircleState>('empty')

    useEffect(() => {
        if (hasError) {
            setCircleState('error')
        }
    }, [hasError])

    useEffect(() => {
        if (pin.length > 0 && circleState !== 'error') {
            setCircleState('filled')
        } else if (pin.length === 0 && circleState !== 'error') {
            setCircleState('empty')
        }
    }, [pin, circleState])

    const handleKeyPress = useCallback(
        (key: NumpadKey) => {
            if (key === 'biometric') return

            if (key === 'delete') {
                setPin(prev => {
                    const newPin = prev.slice(0, -1)
                    onPinChange?.(newPin)
                    return newPin
                })
                return
            }

            setPin(prev => {
                if (prev.length >= pinLength) return prev

                const newPin = prev + key
                onPinChange?.(newPin)

                if (newPin.length === pinLength) {
                    setTimeout(() => {
                        onPinComplete(newPin)
                    }, 100)
                }

                return newPin
            })
        },
        [pinLength, onPinComplete, onPinChange],
    )

    const clearPin = useCallback(() => {
        setPin('')
        setCircleState('empty')
    }, [])

    return {
        pin,
        circleState,
        handleKeyPress,
        clearPin,
    }
}
