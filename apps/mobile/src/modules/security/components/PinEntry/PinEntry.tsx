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

import { View } from 'react-native'
import { PWText, PWNumpad, PWPinCircles, NumpadKey } from '@components/core'
import { usePinEntry } from './usePinEntry'
import { useStyles } from './styles'

export type PinEntryMode =
    | 'setup'
    | 'confirm'
    | 'verify'
    | 'change_old'
    | 'change_new'
    | 'change_confirm'

export type PinEntryProps = {
    mode: PinEntryMode
    title: string
    subtitle?: string
    pinLength?: number
    onPinComplete: (pin: string) => void
    onPinChange?: (pin: string) => void
    isDisabled?: boolean
    showBiometric?: boolean
    onBiometricPress?: () => void
    hasError?: boolean
    onErrorAnimationComplete?: () => void
}

export const PinEntry = ({
    mode,
    title,
    subtitle,
    pinLength = 6,
    onPinComplete,
    onPinChange,
    isDisabled = false,
    showBiometric = false,
    onBiometricPress,
    hasError = false,
    onErrorAnimationComplete,
}: PinEntryProps) => {
    const styles = useStyles()
    const { pin, circleState, handleKeyPress, clearPin } = usePinEntry({
        pinLength,
        onPinComplete,
        onPinChange,
        hasError,
        onErrorAnimationComplete,
    })

    const handleNumpadKeyPress = (key: NumpadKey) => {
        if (key === 'biometric') {
            onBiometricPress?.()
            return
        }
        handleKeyPress(key)
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {title}
                </PWText>
                {subtitle && (
                    <PWText
                        variant='body'
                        style={styles.subtitle}
                    >
                        {subtitle}
                    </PWText>
                )}
            </View>

            <View style={styles.circlesContainer}>
                <PWPinCircles
                    length={pinLength}
                    filledCount={pin.length}
                    state={circleState}
                    onShakeComplete={() => {
                        clearPin()
                        onErrorAnimationComplete?.()
                    }}
                />
            </View>

            <View style={styles.numpadContainer}>
                <PWNumpad
                    onKeyPress={handleNumpadKeyPress}
                    isDisabled={isDisabled}
                    showBiometric={showBiometric && mode === 'verify'}
                />
            </View>
        </View>
    )
}
