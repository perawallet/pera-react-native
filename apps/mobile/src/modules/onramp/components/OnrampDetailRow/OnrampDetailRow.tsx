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

import type { ReactNode } from 'react'
import type { StyleProp, TextStyle } from 'react-native'
import { PWText, PWView } from '@components/core'
import { useStyles } from './styles'

export type OnrampDetailRowProps = {
    label: string
    value?: string
    valueStyle?: StyleProp<TextStyle>
    children?: ReactNode
}

export const OnrampDetailRow = ({
    label,
    value,
    valueStyle,
    children,
}: OnrampDetailRowProps) => {
    const styles = useStyles()

    return (
        <PWView style={styles.detailRow}>
            <PWText
                variant='body'
                style={styles.detailLabel}
            >
                {label}
            </PWText>
            {children ?? (
                <PWText
                    variant='body'
                    style={[styles.detailValue, valueStyle]}
                >
                    {value}
                </PWText>
            )}
        </PWView>
    )
}
