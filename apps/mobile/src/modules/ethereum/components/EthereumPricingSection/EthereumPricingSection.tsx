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
import { formatAssetAmount } from '@perawallet/wallet-core-assets'
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import { PWText } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import { TechnicalBlock, TechnicalSection } from '@modules/signing'
import type { Optional } from '@perawallet/wallet-core-shared'
import type { EthereumTransactionPricing } from '../../utils/transactionPricing'

const GWEI_DECIMALS = 9

// The gas labels are long and their values short, so the label wraps rather than truncates.
const UNTRUNCATED = { truncate: false }

type PricingRow = {
    testID: string
    labelKey: I18nKey
    gasUnits?: bigint
    wei?: Decimal
    count?: number
}

export type EthereumPricingSectionProps = {
    pricing: EthereumTransactionPricing
}

/** The transaction's nonce, gas and per-gas prices: whichever of them its source knows. */
export const EthereumPricingSection = ({
    pricing,
}: EthereumPricingSectionProps) => {
    const { t } = useLanguage()
    const gwei = {
        decimals: GWEI_DECIMALS,
        unitName: t('ethereum.pricing.gwei'),
    }
    const rows: PricingRow[] = [
        {
            testID: 'ethereum_nonce',
            labelKey: i18nKey('ethereum.pricing.nonce'),
            count: pricing.nonce,
        },
        {
            testID: 'ethereum_gas_limit',
            labelKey: i18nKey('ethereum.pricing.gas_limit'),
            gasUnits: pricing.gasLimit,
        },
        {
            testID: 'ethereum_gas_used',
            labelKey: i18nKey('ethereum.pricing.gas_used'),
            gasUnits: pricing.gasUsed,
        },
        {
            testID: 'ethereum_max_fee_per_gas',
            labelKey: i18nKey('ethereum.pricing.max_fee_per_gas'),
            wei: pricing.maxFeePerGas,
        },
        {
            testID: 'ethereum_max_priority_fee_per_gas',
            labelKey: i18nKey('ethereum.pricing.max_priority_fee_per_gas'),
            wei: pricing.maxPriorityFeePerGas,
        },
        {
            testID: 'ethereum_gas_price',
            labelKey: i18nKey('ethereum.pricing.gas_price'),
            wei: pricing.gasPrice,
        },
    ]
    const valueOf = (row: PricingRow): Optional<string> => {
        if (row.count !== undefined) return String(row.count)
        if (row.gasUnits !== undefined) return row.gasUnits.toString()
        return row.wei && formatAssetAmount(row.wei, gwei)
    }

    return (
        <TechnicalSection
            title={t('signing.technical.transaction')}
            testID='ethereum_detail_advanced'
        >
            <TechnicalBlock>
                {rows.map(row => {
                    const value = valueOf(row)
                    return value === undefined ? null : (
                        <KeyValueRow
                            key={row.testID}
                            testID={row.testID}
                            title={t(row.labelKey)}
                            titleProps={UNTRUNCATED}
                        >
                            <PWText>{value}</PWText>
                        </KeyValueRow>
                    )
                })}
            </TechnicalBlock>
        </TechnicalSection>
    )
}
