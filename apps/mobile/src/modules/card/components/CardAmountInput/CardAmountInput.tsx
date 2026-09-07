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
import type { Maybe } from '@perawallet/wallet-core-shared'
import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useStyles } from './styles'

type CardAmountInputProps = {
    /** Header label above the amount, e.g. "Amount". */
    label: string
    /** Right-aligned header text, e.g. "Balance: 12.00". */
    balanceText: string
    /** Raw typed amount string, or null/undefined when empty. */
    amount: Maybe<string>
    /** Chip contents (icon/text); rendered inside the styled chip container. */
    chip: ReactNode
    /** Makes the chip tappable (e.g. opens an asset selector). */
    onChipPress?: () => void
    chipTestID?: string
    amountTestID?: string
    /** Extra rows under the amount (secondary value, swap rate). */
    children?: ReactNode
}

/**
 * Amount-entry card shared by the card Add Funds and Withdraw screens: header
 * labels, the typed amount, and an asset chip slot so the two can't drift.
 */
export const CardAmountInput = ({
    label,
    balanceText,
    amount,
    chip,
    onChipPress,
    chipTestID,
    amountTestID,
    children,
}: CardAmountInputProps) => {
    const styles = useStyles()

    return (
        <PWView style={styles.amountCard}>
            <PWView style={styles.amountCardHeader}>
                <PWText
                    variant='body'
                    style={styles.mutedLabel}
                >
                    {label}
                </PWText>
                <PWText
                    variant='body'
                    style={styles.mutedLabel}
                >
                    {balanceText}
                </PWText>
            </PWView>

            <PWView style={styles.amountRow}>
                <PWText
                    variant='h3'
                    numberOfLines={1}
                    style={
                        amount ? styles.amountValue : styles.amountPlaceholder
                    }
                    testID={amountTestID}
                >
                    {amount ?? '0'}
                </PWText>
                {onChipPress ? (
                    <PWTouchableOpacity
                        style={styles.assetChip}
                        onPress={onChipPress}
                        testID={chipTestID}
                    >
                        {chip}
                    </PWTouchableOpacity>
                ) : (
                    <PWView style={styles.assetChip}>{chip}</PWView>
                )}
            </PWView>

            {children}
        </PWView>
    )
}
