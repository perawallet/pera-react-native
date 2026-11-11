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

import { formatAssetAmount } from '@perawallet/wallet-core-assets'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { PWText, PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionDetailCard } from '@modules/signing'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { EthereumApprovalDetails } from '../EthereumApprovalDetails'
import { EthereumContractActionDetails } from '../EthereumContractActionDetails'
import { EthereumContractCallDetails } from '../EthereumContractCallDetails'
import { EthereumTransferAssetRows } from '../EthereumTransferAssetRows'
import { EthereumRawCallRows } from './EthereumRawCallRows'
import { useStyles } from './styles'

const GWEI_DECIMALS = 9

type EthereumTransactionDetailSectionProps = {
    presentation: EthereumTransactionPresentation
    /** Whether the hero already carries the amount; the presentation's own when unset. */
    isAmountInHero?: boolean
    /** A transfer's asset and amount are shown in their own card, so only its holder is listed here. */
    isAssetInCard?: boolean
    /** The request the transaction is under review in; a history record has none. */
    source?: SignRequestSource
    verifiedOrigin?: string
}

/** What only an EVM transaction has: the token or NFT moved and the call and approval it made, then under Advanced the raw call, nonce, gas limit and per-gas fees, and the most it can cost before it is mined. */
export const EthereumTransactionDetailSection = ({
    presentation,
    isAmountInHero = !!presentation.amount?.asset,
    isAssetInCard = false,
    source,
    verifiedOrigin,
}: EthereumTransactionDetailSectionProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const gwei = {
        decimals: GWEI_DECIMALS,
        unitName: t('ethereum.pricing.gwei'),
    }
    const {
        view,
        scope,
        standardCall,
        contractAction,
        isTransfer,
        amount,
        isAmountLoading,
        maxFee,
        sender,
    } = presentation
    const isMined = 'isMined' in view
    const isAssetElsewhere = isTransfer && isAssetInCard
    // The hero carries a resolved amount, so a row repeats it only when it can't.
    const hasAmountRow =
        !isAmountInHero && !isAssetElsewhere && (isAmountLoading || !!amount)

    if (view.kind === 'transfer' && isMined && !hasAmountRow) {
        return null
    }
    if (isAssetElsewhere && isMined && !sender) {
        return null
    }

    let callDetails
    if (!isTransfer) {
        // What the call was read as; the raw call it was read from is under Advanced.
        callDetails = (
            <>
                {!!standardCall && (
                    <EthereumApprovalDetails
                        presentation={presentation}
                        source={source}
                        verifiedOrigin={verifiedOrigin}
                    />
                )}
                {!standardCall && !!contractAction && (
                    <EthereumContractActionDetails
                        presentation={presentation}
                    />
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
                    isAssetShown={!isAssetElsewhere}
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

    const hasAdvanced = !isTransfer || 'fee' in view
    // The gas labels are long and their values short, so the label wraps rather than truncates.
    const untruncated = { truncate: false }

    return (
        <TransactionDetailCard>
            {callDetails}

            {hasAdvanced && (
                <TitledExpandablePanel
                    title={t('transactions.contract_call.advanced')}
                    hasVerticalChevron
                >
                    <PWView
                        style={styles.advanced}
                        testID='ethereum_detail_advanced'
                    >
                        {!isTransfer && (
                            <EthereumRawCallRows presentation={presentation} />
                        )}
                        {'fee' in view && (
                            <>
                                <KeyValueRow
                                    testID='ethereum_nonce'
                                    title={t('ethereum.pricing.nonce')}
                                >
                                    <PWText>{String(view.nonce)}</PWText>
                                </KeyValueRow>
                                <KeyValueRow
                                    testID='ethereum_gas_limit'
                                    title={t('ethereum.pricing.gas_limit')}
                                    titleProps={untruncated}
                                >
                                    <PWText>{view.gas.toString()}</PWText>
                                </KeyValueRow>
                                <KeyValueRow
                                    testID='ethereum_max_fee_per_gas'
                                    title={t(
                                        'ethereum.pricing.max_fee_per_gas',
                                    )}
                                    titleProps={untruncated}
                                >
                                    <PWText>
                                        {formatAssetAmount(
                                            view.fee.maxFeePerGas,
                                            gwei,
                                        )}
                                    </PWText>
                                </KeyValueRow>
                                <KeyValueRow
                                    testID='ethereum_max_priority_fee_per_gas'
                                    title={t(
                                        'ethereum.pricing.max_priority_fee_per_gas',
                                    )}
                                    titleProps={untruncated}
                                >
                                    <PWText>
                                        {formatAssetAmount(
                                            view.fee.maxPriorityFeePerGas,
                                            gwei,
                                        )}
                                    </PWText>
                                </KeyValueRow>
                            </>
                        )}
                    </PWView>
                </TitledExpandablePanel>
            )}

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
