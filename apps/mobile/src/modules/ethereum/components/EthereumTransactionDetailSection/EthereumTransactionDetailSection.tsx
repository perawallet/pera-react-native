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

import { PWText } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionDetailCard } from '@modules/signing'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { EthereumApprovalDetails } from '../EthereumApprovalDetails'
import { EthereumContractCallDetails } from '../EthereumContractCallDetails'
import { EthereumTransferAssetRows } from '../EthereumTransferAssetRows'

type EthereumTransactionDetailSectionProps = {
    presentation: EthereumTransactionPresentation
    /** Whether the hero already carries the amount; the presentation's own when unset. */
    isAmountInHero?: boolean
}

/** What only an EVM transaction has: the token or NFT moved, the call and approval it made, and the most it can cost before it is mined. */
export const EthereumTransactionDetailSection = ({
    presentation,
    isAmountInHero = !!presentation.amount?.asset,
}: EthereumTransactionDetailSectionProps) => {
    const { t } = useLanguage()
    const {
        view,
        scope,
        standardCall,
        isTransfer,
        amount,
        isAmountLoading,
        maxFee,
    } = presentation
    const isMined = 'isMined' in view
    // The hero carries a resolved amount, so a row repeats it only when it can't.
    const hasAmountRow = !isAmountInHero && (isAmountLoading || !!amount)

    if (view.kind === 'transfer' && isMined && !hasAmountRow) {
        return null
    }

    let callDetails
    if (!isTransfer) {
        // The approval first, then the raw call it was read from.
        callDetails = (
            <>
                {!!standardCall && (
                    <EthereumApprovalDetails presentation={presentation} />
                )}
                <EthereumContractCallDetails
                    presentation={presentation}
                    variant='detail'
                />
            </>
        )
    } else {
        callDetails = (
            <>
                <EthereumTransferAssetRows
                    presentation={presentation}
                    testIDPrefix='ethereum_detail'
                />
                {hasAmountRow && (
                    <KeyValueRow
                        testID='ethereum_detail_amount'
                        title={t('transactions.common.amount')}
                    >
                        <AssetAmount
                            chainId={scope.chainId}
                            asset={amount?.asset}
                            value={amount?.value}
                            isLoading={isAmountLoading}
                            showSymbol
                            ignorePrivacyMode
                        />
                    </KeyValueRow>
                )}
            </>
        )
    }

    return (
        <TransactionDetailCard>
            {callDetails}

            {!isMined && (
                <KeyValueRow
                    testID='ethereum_max_fee'
                    title={t('send_funds.fee.max_fee')}
                >
                    {maxFee ? (
                        <AssetAmount
                            chainId={scope.chainId}
                            asset={maxFee.asset}
                            value={maxFee.value}
                            showSymbol
                            ignorePrivacyMode
                        />
                    ) : (
                        <PWText>{t('ethereum.batch.fee_when_reached')}</PWText>
                    )}
                </KeyValueRow>
            )}
        </TransactionDetailCard>
    )
}
