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

import { useState, useCallback, useEffect, useRef } from 'react'
import type { NumpadKey } from '@components/core'
import { PIN_LENGTH } from '@perawallet/wallet-core-security'
import { useHaptics } from '@hooks/useHaptics'

const COMPLETION_DELAY = 100

type UsePinEntryParams = {
    onPinComplete: (pin: string) => void
    onPinChange?: (pin: string) => void
    onErrorAnimationComplete?: () => void
    /** Must match the circle count the caller renders. */
    length?: number
    /** A new value starts a new step, so the digits entered so far are dropped. */
    resetKey?: string
    /** Rising edge plays the wrong-PIN haptic, in step with the circles' shake. */
    hasError?: boolean
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
    hasError = false,
}: UsePinEntryParams): UsePinEntryResult => {
    const [pin, setPin] = useState('')
    const { pinDigit, pinError } = useHaptics()
    // Read by the key handler so its identity stays stable across digits (the
    // numpad re-renders on a new one) and two quick presses see each other.
    const pinRef = useRef(pin)
    pinRef.current = pin
    // Reset during render, not in an effect: a mount effect can flush after the
    // first tap and wipe that digit, so the PIN never completes.
    const [entryKey, setEntryKey] = useState(resetKey)
    if (entryKey !== resetKey) {
        setEntryKey(resetKey)
        setPin('')
    }

    useEffect(() => {
        if (hasError) pinError()
    }, [hasError, pinError])

    const clearPin = useCallback(() => {
        setPin('')
    }, [])

    const handleKeyPress = useCallback(
        (key: NumpadKey) => {
            if (key === 'delete') {
                pinRef.current = pinRef.current.slice(0, -1)
                setPin(prev => {
                    const newPin = prev.slice(0, -1)
                    onPinChange?.(newPin)
                    return newPin
                })
                return
            }

            // Outside the updater, which must stay pure.
            if (pinRef.current.length < length) {
                pinRef.current += key
                pinDigit()
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
        [onPinComplete, onPinChange, length, pinDigit],
    )

    return {
        pin,
        handleKeyPress,
        clearPin,
    }
}
