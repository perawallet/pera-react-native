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

export type AmountFieldProps = {
    /** `plain` = bare section (pay); `card` = grey rounded card (receive). */
    variant: 'plain' | 'card'
    label: string
    /** Optional right-aligned header content, e.g. a balance display. */
    headerTrailing?: ReactNode
    /** Sizes the amount row to the matching heading line height. */
    amountSize: 'h1' | 'h2'
    /** The amount element — input, formatted text, or loading skeleton. */
    amount: ReactNode
    /** The asset selector element. */
    selector: ReactNode
    /** The fiat / preferred-currency sub-line element. */
    fiat: ReactNode
    testID?: string
}

// Presentational shell shared by the swap and onramp amount sections: it owns
// the frame (header, input row, fiat row) and spacing only. All data-bearing
// content is passed in as slots so each feature keeps its own logic and hook.
export const AmountField = ({
    variant,
    label,
    headerTrailing,
    amountSize,
    amount,
    selector,
    fiat,
    testID,
}: AmountFieldProps) => {
    const styles = useStyles({ variant, amountSize })

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            <PWView style={styles.headerRow}>
                <PWText
                    variant='body'
                    style={styles.label}
                >
                    {label}
                </PWText>
                {headerTrailing}
            </PWView>

            <PWView style={styles.inputRow}>
                <PWView style={styles.amountContainer}>{amount}</PWView>
                {selector}
            </PWView>

            <PWView style={styles.fiatValueContainer}>{fiat}</PWView>
        </PWView>
    )
}
