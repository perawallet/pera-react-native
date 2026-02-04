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

import { PWText, PWView } from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { useLanguage } from '@hooks/useLanguage'
import Decimal from 'decimal.js'
import { useStyles } from './styles'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { DEFAULT_PRECISION } from '@perawallet/wallet-core-shared'

export type FeeDisplayProps = {
    fee: Decimal
    label?: string
}

export const FeeDisplay = ({ fee, label }: FeeDisplayProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.container}>
            <PWText style={styles.label}>
                {label ?? t('transactions.common.fee')}
            </PWText>
            <CurrencyDisplay
                currency='ALGO'
                precision={ALGO_ASSET.decimals}
                minPrecision={DEFAULT_PRECISION}
                value={fee}
                showSymbol
                style={styles.value}
            />
        </PWView>
    )
}
