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
import { PWTouchableOpacity } from '@components/core/PWTouchableOpacity'
import { PWText } from '@components/core/PWText'
import { PWIcon } from '@components/core/PWIcon'
import { useStyles } from './styles'

export type NumpadKey =
    | '0'
    | '1'
    | '2'
    | '3'
    | '4'
    | '5'
    | '6'
    | '7'
    | '8'
    | '9'
    | 'delete'
    | '.'

export type PWNumpadProps = {
    mode: 'number' | 'pin'
    onKeyPress: (key: NumpadKey) => void
    isDisabled?: boolean
}

const NUMBER_NUMPAD_LAYOUT: (NumpadKey | null)[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', 'delete'],
]

const PIN_NUMPAD_LAYOUT: (NumpadKey | null)[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [null, '0', 'delete'],
]

export const PWNumpad = ({
    onKeyPress,
    isDisabled = false,
    mode = 'number',
}: PWNumpadProps) => {
    const styles = useStyles()

    const handleKeyPress = (key: NumpadKey | null) => {
        if (!key || isDisabled) return
        onKeyPress(key)
    }

    const renderKey = (key: NumpadKey | null, index: number) => {
        if (key === null) {
            return (
                <View
                    key={index}
                    style={styles.keyPlaceholder}
                />
            )
        }

        const isDeleteKey = key === 'delete'

        return (
            <PWTouchableOpacity
                key={index}
                style={[styles.key, isDisabled && styles.keyDisabled]}
                onPress={() => handleKeyPress(key)}
                disabled={isDisabled}
            >
                {isDeleteKey ? (
                    <PWIcon
                        name='delete'
                        size='md'
                        variant={isDisabled ? 'secondary' : 'primary'}
                    />
                ) : (
                    <PWText
                        variant='h2'
                        style={[
                            styles.keyText,
                            isDisabled && styles.keyTextDisabled,
                        ]}
                    >
                        {key}
                    </PWText>
                )}
            </PWTouchableOpacity>
        )
    }

    return (
        <View style={styles.container}>
            {(mode === 'number' ? NUMBER_NUMPAD_LAYOUT : PIN_NUMPAD_LAYOUT).map(
                (row, rowIndex) => (
                    <View
                        key={rowIndex}
                        style={styles.row}
                    >
                        {row.map((key, keyIndex) => renderKey(key, keyIndex))}
                    </View>
                ),
            )}
        </View>
    )
}
