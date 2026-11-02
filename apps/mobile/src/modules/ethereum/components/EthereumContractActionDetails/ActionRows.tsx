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

import { PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import type {
    EthereumBoundedAmount,
    EthereumContractActionPresentation,
} from '../../hooks/useEthereumContractAction'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { SwapLegRow } from './SwapLegRow'
import { useStyles } from './styles'

const payTitleKey = (bound: EthereumBoundedAmount['bound']) =>
    bound === 'at-most'
        ? 'ethereum.contract_action.pay_at_most'
        : 'ethereum.contract_action.pay'

const receiveTitleKey = (bound: EthereumBoundedAmount['bound']) =>
    bound === 'at-least'
        ? 'ethereum.contract_action.receive_at_least'
        : 'ethereum.contract_action.receive'

type ActionRowsProps = {
    action: EthereumContractActionPresentation
    presentation: EthereumTransactionPresentation
}

export const ActionRows = ({ action, presentation }: ActionRowsProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { view, scope, isContractActionLoading } = presentation

    switch (action.kind) {
        case 'swap': {
            const swap = view.action?.kind === 'swap' ? view.action : undefined
            if (!swap) return null
            return (
                <>
                    <SwapLegRow
                        testID='ethereum_action_pay'
                        title={t(payTitleKey(action.input.bound))}
                        leg={action.input}
                        token={swap.input.asset}
                        presentation={presentation}
                    />
                    <SwapLegRow
                        testID='ethereum_action_receive'
                        title={t(receiveTitleKey(action.output.bound))}
                        leg={action.output}
                        token={swap.output.asset}
                        presentation={presentation}
                    />
                </>
            )
        }
        case 'wrap':
        case 'unwrap': {
            return (
                <KeyValueRow
                    testID='ethereum_action_amount'
                    title={t('transactions.common.amount')}
                >
                    <AssetAmount
                        chainId={scope.chainId}
                        asset={action.amount.asset}
                        value={action.amount.value}
                        isLoading={isContractActionLoading}
                        showSymbol
                        ignorePrivacyMode
                    />
                </KeyValueRow>
            )
        }
        case 'supply':
        case 'withdraw':
        case 'borrow':
        case 'repay': {
            return (
                <>
                    <KeyValueRow
                        testID='ethereum_action_asset'
                        title={t('transactions.common.asset')}
                        verticalAlignment='top'
                    >
                        <PWView style={styles.amount}>
                            {!!action.amount.asset && (
                                <PWText>{action.amount.asset.unitName}</PWText>
                            )}
                            <AddressDisplay
                                address={action.assetContract}
                                displayType='address-only'
                                scope={scope}
                            />
                        </PWView>
                    </KeyValueRow>
                    <KeyValueRow
                        testID='ethereum_action_amount'
                        title={t('transactions.common.amount')}
                    >
                        {action.isEntireBalance ? (
                            <PWText>
                                {t('ethereum.contract_action.entire_balance')}
                            </PWText>
                        ) : (
                            <AssetAmount
                                chainId={scope.chainId}
                                asset={action.amount.asset}
                                value={action.amount.value}
                                isLoading={isContractActionLoading}
                                showSymbol
                                ignorePrivacyMode
                            />
                        )}
                    </KeyValueRow>
                </>
            )
        }
    }
}
