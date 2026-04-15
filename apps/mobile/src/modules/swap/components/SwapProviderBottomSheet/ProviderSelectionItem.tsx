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

import { ReactNode } from 'react'
import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useStyles } from './styles'

export type ProviderSelectionItemProps = {
    left: ReactNode
    label: string
    right: ReactNode
    isSelected: boolean
    onPress: () => void
    testID?: string
}

export const ProviderSelectionItem = ({
    left,
    label,
    right,
    isSelected,
    onPress,
    testID,
}: ProviderSelectionItemProps) => {
    const styles = useStyles()

    return (
        <PWTouchableOpacity
            style={styles.item}
            onPress={onPress}
            testID={testID}
        >
            <PWView style={styles.itemLeft}>
                {left}
                <PWText
                    variant='body'
                    style={styles.itemLabel}
                >
                    {label}
                </PWText>
            </PWView>
            <PWView style={styles.itemRight}>
                {right}
                <PWView
                    style={[
                        styles.radioContainer,
                        isSelected && styles.radioSelectedBorder,
                    ]}
                    testID={testID ? `${testID}-radio` : undefined}
                >
                    {isSelected && <PWView style={styles.radioInner} />}
                </PWView>
            </PWView>
        </PWTouchableOpacity>
    )
}
