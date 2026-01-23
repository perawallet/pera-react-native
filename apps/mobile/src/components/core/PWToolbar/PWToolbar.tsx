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

import React from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import { PWView } from '../PWView'
import { useStyles } from './styles'

export type PWToolbarProps = {
    left?: React.ReactNode
    center?: React.ReactNode
    right?: React.ReactNode
    style?: StyleProp<ViewStyle>
    testID?: string
}

export const PWToolbar = ({
    left,
    center,
    right,
    style,
    testID,
}: PWToolbarProps) => {
    const styles = useStyles()

    return (
        <PWView
            style={[styles.container, style]}
            testID={testID}
        >
            <PWView
                style={styles.leftSlotContainer}
                testID={testID ? `${testID}-left` : undefined}
            >
                {left}
            </PWView>

            <PWView
                style={styles.centerSlotContainer}
                testID={testID ? `${testID}-center` : undefined}
            >
                {center}
            </PWView>

            <PWView
                style={styles.rightSlotContainer}
                testID={testID ? `${testID}-right` : undefined}
            >
                {right}
            </PWView>
        </PWView>
    )
}
