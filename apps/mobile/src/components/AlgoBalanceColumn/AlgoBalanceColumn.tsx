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

import { ALGO_ASSET, ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'
import { PWView, PWViewProps } from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { PreferredCurrencyDisplay } from '@components/PreferredCurrencyDisplay'
import { useStyles } from './styles'

import type { Decimal } from 'decimal.js'
import type { TypographyVariant } from '@theme/typography'

export type AlgoBalanceColumnProps = {
    algoValue?: Decimal | undefined
    algoVariant?: TypographyVariant
    fiatVariant?: TypographyVariant
} & PWViewProps

export const AlgoBalanceColumn = ({
    algoValue,
    algoVariant = 'bodyCompact',
    fiatVariant = 'bodyCompact',
    ...rest
}: AlgoBalanceColumnProps) => {
    const styles = useStyles()

    return (
        <PWView
            {...rest}
            style={[styles.container, rest.style]}
        >
            <CurrencyDisplay
                currency='ALGO'
                value={algoValue}
                precision={ALGO_ASSET.decimals}
                minPrecision={2}
                variant={algoVariant}
            />
            <PreferredCurrencyDisplay
                sourceAssetId={ALGO_ASSET_ID}
                sourceAmount={algoValue}
                precision={2}
                minPrecision={2}
                variant={fiatVariant}
                style={styles.fiatText}
            />
        </PWView>
    )
}
