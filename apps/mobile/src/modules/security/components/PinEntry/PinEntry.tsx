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
import { PIN_LENGTH } from '@perawallet/wallet-core-security'
import { useCallback, useEffect } from 'react'

export type PinEntryProps = {
    title: string
    onPinComplete: (pin: string) => void
    onPinChange?: (pin: string) => void
    isDisabled?: boolean
    hasError?: boolean
    onErrorAnimationComplete?: () => void
}

export const PinEntry = ({
    title,
    onPinComplete,
    onPinChange,
    isDisabled = false,
    hasError = false,
    onErrorAnimationComplete,
}: PinEntryProps) => {
    const styles = useStyles()

    const { pin, handleKeyPress, clearPin } = usePinEntry({
        onPinComplete,
        onPinChange,
        onErrorAnimationComplete,
    })

    const handleNumpadKeyPress = useCallback(
        (key: NumpadKey) => {
            handleKeyPress(key)
        },
        [handleKeyPress],
    )

    useEffect(() => {
        clearPin()
    }, [title])

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {title}
                </PWText>
            </View>

            <View style={styles.circlesContainer}>
                <PWPinCircles
                    length={PIN_LENGTH}
                    filledCount={pin.length}
                    hasError={hasError}
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
                    mode='pin'
                />
            </View>
        </View>
    )
}
