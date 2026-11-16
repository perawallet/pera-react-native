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
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import type {
    EthereumBoundedAmount,
    EthereumContractActionPresentation,
} from '../../hooks/useEthereumContractAction'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { ActionAmount } from './ActionAmount'
import { PositionRow } from './PositionRow'
import { SwapFeeRow } from './SwapFeeRow'
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
    const { view, scope } = presentation

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
                    {action.fees.map((fee, index) => (
                        <SwapFeeRow
                            key={`${fee.recipient}-${index}`}
                            testID={`ethereum_action_fee_${index}`}
                            fee={fee}
                            presentation={presentation}
                        />
                    ))}
                </>
            )
        }
        case 'add-liquidity': {
            const add =
                view.action?.kind === 'add-liquidity' ? view.action : undefined
            if (!add) return null
            return (
                <>
                    {action.deposits.map((deposit, index) => (
                        <SwapLegRow
                            key={index}
                            testID={`ethereum_action_deposit_${index}`}
                            title={t(
                                'ethereum.contract_action.deposit_at_most',
                            )}
                            leg={deposit}
                            token={add.deposits[index].asset}
                            presentation={presentation}
                        />
                    ))}
                    <PositionRow position={action.position} />
                </>
            )
        }
        case 'remove-liquidity': {
            return (
                <>
                    <PositionRow
                        position={{ kind: 'existing', tokenId: action.tokenId }}
                    />
                    {action.isClosing && (
                        <PWText
                            testID='ethereum_action_closes_position'
                            variant='caption'
                            style={styles.note}
                        >
                            {t('ethereum.contract_action.closes_position')}
                        </PWText>
                    )}
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
                    <ActionAmount
                        amount={action.amount}
                        presentation={presentation}
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
                            <ActionAmount
                                amount={action.amount}
                                presentation={presentation}
                            />
                        )}
                    </KeyValueRow>
                </>
            )
        }
    }
}
