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
import { AssetAmount } from '@components/AssetAmount'
import { useLanguage } from '@hooks/useLanguage'
import type { EthereumActionAmount } from '../../hooks/useEthereumContractAction'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { useStyles } from './styles'

type ActionAmountProps = {
    amount: EthereumActionAmount
    presentation: EthereumTransactionPresentation
}

// With no token record the figure is raw base units, so it says so rather than reading as a whole-token amount.
export const ActionAmount = ({ amount, presentation }: ActionAmountProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    return (
        <PWView style={styles.amountLine}>
            <AssetAmount
                chainId={presentation.scope.chainId}
                asset={amount.asset}
                value={amount.value}
                isLoading={presentation.isContractActionLoading}
                showSymbol
                ignorePrivacyMode
            />
            {amount.isBaseUnits && (
                <PWText
                    variant='caption'
                    testID='ethereum_action_base_units'
                >
                    {t('ethereum.contract_action.base_units')}
                </PWText>
            )}
        </PWView>
    )
}
