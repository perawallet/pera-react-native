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

import { PWIcon, PWText, PWView } from '@components/core'
import { AccountDisplay } from '@components/AccountDisplay'
import { AddressDisplay } from '@components/AddressDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { ChainLabel } from '@modules/chain-ui/icon'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import { SwapProviderDisplay } from '../SwapProviderDisplay'
import { DetailRow } from './DetailRow'
import { useStyles } from './styles'
import type { SwapReceiveTarget } from './useSwapConfirmation'

type SwapDetailsSectionProps = {
    quote: SwapQuote
    sourceChainId: ChainId
    receiveTarget: Nullable<SwapReceiveTarget>
    rateDisplay: string
    minimumReceivedDisplay: Nullable<string>
    peraFeeDisplay: Nullable<string>
    providerFeeDisplay: Nullable<string>
    networkFeeDisplay: Nullable<string>
    slippageDisplay: Nullable<string>
    priceImpactDisplay: Nullable<string>
    priceImpactStyle: object
}

export const SwapDetailsSection = ({
    quote,
    sourceChainId,
    receiveTarget,
    rateDisplay,
    minimumReceivedDisplay,
    peraFeeDisplay,
    providerFeeDisplay,
    networkFeeDisplay,
    slippageDisplay,
    priceImpactDisplay,
    priceImpactStyle,
}: SwapDetailsSectionProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    return (
        <PWView style={styles.detailsSection}>
            {receiveTarget && (
                <DetailRow label={t('swap.receiving_account.label')}>
                    {receiveTarget.account ? (
                        <AccountDisplay
                            account={receiveTarget.account}
                            chainId={receiveTarget.scope.chainId}
                            showChainBadge
                            showChevron={false}
                            iconProps={{ size: 'sm' }}
                            textProps={{ variant: 'caption' }}
                            testID='swap-confirm-receive-account'
                        />
                    ) : (
                        <AddressDisplay
                            address={receiveTarget.address}
                            scope={receiveTarget.scope}
                            unnamedAddressFormat='full'
                        />
                    )}
                </DetailRow>
            )}
            {receiveTarget && (
                <DetailRow label={t('swap.quote.route')}>
                    <PWView
                        style={styles.rateValueRow}
                        testID='swap-confirm-route'
                    >
                        <ChainLabel chainId={sourceChainId} />
                        <PWIcon
                            name='chevron-right'
                            size='xs'
                        />
                        <ChainLabel chainId={receiveTarget.scope.chainId} />
                    </PWView>
                </DetailRow>
            )}
            <DetailRow label={t('swap.quote.rate')}>
                <PWView style={styles.rateValueRow}>
                    <PWText
                        style={styles.detailValue}
                        testID='swap-confirm-rate'
                    >
                        {rateDisplay}
                    </PWText>
                    <PWView style={styles.rateIcon}>
                        <PWIcon
                            name='swap'
                            size='xs'
                        />
                    </PWView>
                </PWView>
            </DetailRow>
            <DetailRow label={t('swap.quote.provider')}>
                <SwapProviderDisplay
                    provider={quote.provider}
                    testID='swap-confirm-provider'
                />
            </DetailRow>
            {slippageDisplay && (
                <DetailRow
                    label={t('swap.quote.slippage_tolerance')}
                    testID='swap-confirm-slippage'
                    value={slippageDisplay}
                    valueStyle={styles.detailValue}
                    info={t('swap.info.slippage_tolerance')}
                />
            )}
            {priceImpactDisplay && (
                <DetailRow
                    label={t('swap.quote.price_impact')}
                    testID='swap-confirm-price-impact'
                    value={priceImpactDisplay}
                    valueStyle={priceImpactStyle}
                    info={t('swap.info.price_impact')}
                />
            )}
            {minimumReceivedDisplay && (
                <DetailRow
                    label={t('swap.quote.minimum_received')}
                    testID='swap-confirm-min-received'
                    value={minimumReceivedDisplay}
                    valueStyle={styles.detailValue}
                />
            )}
            {peraFeeDisplay && (
                <DetailRow
                    label={t('swap.quote.pera_fee')}
                    testID='swap-confirm-pera-fee'
                    value={peraFeeDisplay}
                    valueStyle={styles.detailValue}
                />
            )}
            {providerFeeDisplay && (
                <DetailRow
                    label={t('swap.quote.provider_fee')}
                    testID='swap-confirm-provider-fee'
                    value={providerFeeDisplay}
                    valueStyle={styles.detailValue}
                />
            )}
            {networkFeeDisplay && (
                <DetailRow
                    label={t('swap.quote.network_fee')}
                    testID='swap-confirm-network-fee'
                    value={networkFeeDisplay}
                    valueStyle={styles.detailValue}
                />
            )}
        </PWView>
    )
}
