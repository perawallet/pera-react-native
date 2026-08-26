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

import { memo } from 'react'
import { useTheme } from '@rneui/themed'
import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useStyles } from './styles'

export type NumberPadProps = {
    onPress: (key?: string) => void
    allowDecimal?: boolean
}

const padArrangment = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', undefined],
]

export const NumberPad = memo(
    ({ onPress, allowDecimal = true }: NumberPadProps) => {
        const styles = useStyles()
        const { theme } = useTheme()

        // Horizontal only: rows touch vertically, so vertical slop would let
        // a key claim presses landing inside its neighbor above (siblings are
        // hit-tested in reverse order) and steal taps meant for controls
        // below the pad. The inter-key gaps are horizontal dead space.
        const keyHitSlop = {
            left: theme.spacing.xl,
            right: theme.spacing.xl,
        }

        return (
            <PWView style={styles.container}>
                {padArrangment.map((row, idx) => (
                    <PWView
                        style={styles.row}
                        key={`numpad-row-${idx}`}
                    >
                        {row.map((key, keyIdx) => {
                            const isDecimalKey = key === '.'
                            const isInert = isDecimalKey && !allowDecimal
                            if (isInert) {
                                return (
                                    <PWView
                                        key={`numpad-key-${idx}-${keyIdx}`}
                                        style={styles.key}
                                    />
                                )
                            }
                            const keyTestID = key
                                ? key === '.'
                                    ? 'numpad_key_decimal'
                                    : `numpad_key_${key}`
                                : 'numpad_key_delete'
                            return (
                                <PWTouchableOpacity
                                    key={`numpad-key-${idx}-${keyIdx}`}
                                    onPress={() => onPress(key)}
                                    style={styles.key}
                                    testID={keyTestID}
                                    allowRapidPress
                                    hitSlop={keyHitSlop}
                                >
                                    {!!key && (
                                        <PWText
                                            variant='h1'
                                            style={styles.keyText}
                                        >
                                            {key}
                                        </PWText>
                                    )}
                                    {!key && <PWIcon name='delete' />}
                                </PWTouchableOpacity>
                            )
                        })}
                    </PWView>
                ))}
            </PWView>
        )
    },
)
