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

import { Trans } from 'react-i18next'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PreferredAmount } from '@components/PreferredAmount'
import { feeAssetAmountPropsOf } from '@components/FeeRow'
import { InfoButton } from '@components/InfoButton'
import { useLanguage } from '@hooks/useLanguage'
import { ReviewFeeRow } from '@modules/signing'
import type { EthereumReviewFee } from '@modules/ethereum/hooks/useEthereumTransactionPresentation'
import { useStyles } from './styles'

export type EthereumReviewFeeRowProps = {
    scope: ChainScope
    reviewFee: EthereumReviewFee
}

/** The fee the network is expected to take, then the most it can. Amounts are in wei. */
export const EthereumReviewFeeRow = ({
    scope,
    reviewFee,
}: EthereumReviewFeeRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const expected = feeAssetAmountPropsOf(
        scope,
        reviewFee.estimate?.amount ?? reviewFee.maxAmount,
    )
    const maximum = feeAssetAmountPropsOf(scope, reviewFee.maxAmount)

    return (
        <ReviewFeeRow
            testID='ethereum_review_fee'
            labelAccessory={
                <InfoButton
                    testID='ethereum_review_fee_info'
                    title={t('send_funds.fee.max_fee')}
                >
                    {t('send_funds.fee.max_fee_info')}
                </InfoButton>
            }
            expected={
                <PreferredAmount
                    sourceAmount={expected.value}
                    sourceAssetId={expected.asset.assetId}
                    scope={scope}
                    variant='h4'
                    ignorePrivacyMode
                    alignRight
                    style={styles.expected}
                    testID='ethereum_review_fee_expected'
                />
            }
            maximum={
                <Trans
                    i18nKey='signing.review.fee_max'
                    values={{ symbol: maximum.asset.unitName }}
                    components={[
                        <PreferredAmount
                            key='max'
                            sourceAmount={maximum.value}
                            sourceAssetId={maximum.asset.assetId}
                            scope={scope}
                            variant='caption'
                            ignorePrivacyMode
                            isInline
                            style={styles.maximum}
                            testID='ethereum_review_fee_max'
                        />,
                    ]}
                />
            }
        />
    )
}
