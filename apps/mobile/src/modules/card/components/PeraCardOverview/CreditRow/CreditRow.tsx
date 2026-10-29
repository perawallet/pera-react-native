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

import type { Decimal } from 'decimal.js'
import type { CardWalletKind } from '@perawallet/wallet-core-card'
import { PWIcon, PWListItemLayout, PWText, PWView } from '@components/core'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { useStyles } from './styles'

export type CreditRowProps = {
    kind: CardWalletKind
    label: string
    amount: Decimal
    currency: string
    onPress: (kind: CardWalletKind) => void
    testID: string
}

export const CreditRow = ({
    kind,
    label,
    amount,
    currency,
    onPress,
    testID,
}: CreditRowProps) => {
    const styles = useStyles()

    return (
        <PWListItemLayout
            style={styles.cardRow}
            onPress={() => onPress(kind)}
            testID={testID}
            right={
                <PWView style={styles.rowRight}>
                    <CurrencyAmount
                        value={amount}
                        currency={currency}
                        assetId={null}
                        precision='compact'
                        symbolPosition='end'
                        variant='bodyLarge'
                        weight={500}
                        style={styles.rowValue}
                    />
                    <PWIcon
                        name='chevron-right'
                        size='sm'
                        variant='secondary'
                    />
                </PWView>
            }
        >
            <PWText
                variant='bodyLarge'
                weight={400}
            >
                {label}
            </PWText>
        </PWListItemLayout>
    )
}
