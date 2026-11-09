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
import { Trans } from 'react-i18next'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { AssetAmount } from '@components/AssetAmount'
import { feeAssetAmountPropsOf } from '@components/FeeRow'
import { ReviewWarningText } from '@modules/signing'
import { useStyles } from './styles'

type EthereumHighFeeMessageProps = {
    scope: ChainScope
    /** Wei: the most the signature authorises, the same figure as the Max fee row. */
    maxFee: Decimal
    requesterHost: Optional<string>
}

export const EthereumHighFeeMessage = ({
    scope,
    maxFee,
    requesterHost,
}: EthereumHighFeeMessageProps) => {
    const styles = useStyles()
    const amount = (
        <AssetAmount
            key='max_fee'
            {...feeAssetAmountPropsOf(scope, maxFee)}
            variant='body'
            style={styles.feeAmount}
            isInline
        />
    )

    return (
        <ReviewWarningText testID='ethereum_high_fee_body'>
            {requesterHost ? (
                <Trans
                    i18nKey='ethereum.review_warnings.high_fee_body'
                    values={{ domain: requesterHost }}
                    components={[amount]}
                />
            ) : (
                <Trans
                    i18nKey='ethereum.review_warnings.high_fee_body_no_source'
                    components={[amount]}
                />
            )}
        </ReviewWarningText>
    )
}
