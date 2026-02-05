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

import {
    PeraDisplayableTransaction,
    microAlgosToAlgos,
} from '@perawallet/wallet-core-blockchain'
import { PWText, PWView } from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import {
    ALGO_ASSET,
    useAssetFiatPricesQuery,
} from '@perawallet/wallet-core-assets'
import { DEFAULT_PRECISION } from '@perawallet/wallet-core-shared'
import Decimal from 'decimal.js'
import { useStyles } from './styles'
import { AddressDisplay } from '@components/AddressDisplay'
import { useTheme } from '@rneui/themed'
import { useMemo } from 'react'
import { useCurrency } from '@perawallet/wallet-core-currencies'
import { useLanguage } from '@hooks/useLanguage'

export const PaymentTransactionSummaryHeader = ({
    transaction,
}: {
    transaction: PeraDisplayableTransaction
}) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const { preferredFiatCurrency, showAlgoAsPrimaryCurrency } = useCurrency()

    const { data: fiatPrices, isPending } = useAssetFiatPricesQuery(
        !showAlgoAsPrimaryCurrency,
    )
    const value = useMemo(() => {
        if (isPending) {
            return undefined
        }
        return (
            fiatPrices?.get(ALGO_ASSET.assetId)?.fiatPrice ?? new Decimal(0)
        ).mul(microAlgosToAlgos(transaction.paymentTransaction?.amount ?? 0n))
    }, [fiatPrices, isPending])

    return (
        <PWView style={styles.container}>
            <PWText style={styles.typeText}>
                {t('transactions.summary.payment_to')}
            </PWText>
            <AddressDisplay
                style={styles.address}
                textProps={{ style: styles.addressText }}
                iconProps={{ color: theme.colors.textMain }}
                address={transaction.paymentTransaction?.receiver || ''}
            />
            <PWView style={styles.amountContainer}>
                <CurrencyDisplay
                    currency='ALGO'
                    precision={ALGO_ASSET.decimals}
                    minPrecision={DEFAULT_PRECISION}
                    value={Decimal(
                        microAlgosToAlgos(
                            transaction.paymentTransaction?.amount ?? 0n,
                        ),
                    )}
                    showSymbol
                    variant='h1'
                    style={styles.amountValue}
                />
                {!!value && (
                    <CurrencyDisplay
                        currency={preferredFiatCurrency}
                        precision={DEFAULT_PRECISION}
                        minPrecision={DEFAULT_PRECISION}
                        value={value}
                        showSymbol
                        variant='h4'
                        style={styles.secondaryAmountValue}
                    />
                )}
            </PWView>
        </PWView>
    )
}
