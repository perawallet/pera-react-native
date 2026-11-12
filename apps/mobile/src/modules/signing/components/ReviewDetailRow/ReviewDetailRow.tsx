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
import { PWText, PWView } from '@components/core'
import { useStyles } from './styles'

export type ReviewDetailRowProps = {
    label: string
    /** Beside the label, such as an info button. */
    labelAccessory?: ReactNode
    children: ReactNode
    testID?: string
}

export const ReviewDetailRow = ({
    label,
    labelAccessory,
    children,
    testID,
}: ReviewDetailRowProps) => {
    const styles = useStyles()

    return (
        <PWView
            style={styles.row}
            testID={testID}
        >
            <PWView style={styles.label}>
                <PWText
                    variant='bodyLarge'
                    style={styles.labelText}
                >
                    {label}
                </PWText>
                {labelAccessory}
            </PWView>
            <PWView style={styles.value}>{children}</PWView>
        </PWView>
    )
}
