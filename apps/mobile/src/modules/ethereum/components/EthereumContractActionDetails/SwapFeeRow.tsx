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

import { formatPercentage } from '@perawallet/wallet-core-shared'
import { PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { KeyValueRow } from '@components/KeyValueRow'
import { useLanguage } from '@hooks/useLanguage'
import type { EthereumSwapFeePresentation } from '../../hooks/useEthereumContractAction'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { ActionAmount } from './ActionAmount'
import { useStyles } from './styles'

type SwapFeeRowProps = {
    testID: string
    fee: EthereumSwapFeePresentation
    presentation: EthereumTransactionPresentation
}

// A fee is paid out of what the user would receive, so who gets it is always shown.
export const SwapFeeRow = ({ testID, fee, presentation }: SwapFeeRowProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { scope } = presentation
    return (
        <KeyValueRow
            testID={testID}
            title={t('ethereum.contract_action.fee')}
            verticalAlignment='top'
        >
            <PWView style={styles.amount}>
                {fee.size.kind === 'percent' ? (
                    <PWText>
                        {t('ethereum.contract_action.fee_share', {
                            percent: formatPercentage(fee.size.percent),
                        })}
                    </PWText>
                ) : (
                    <ActionAmount
                        amount={fee.size.amount}
                        presentation={presentation}
                    />
                )}
                <AddressDisplay
                    testID={`${testID}_token`}
                    address={fee.token}
                    displayType='address-only'
                    scope={scope}
                />
                <PWText variant='caption'>
                    {t('ethereum.contract_action.fee_recipient')}
                </PWText>
                <AddressDisplay
                    testID={`${testID}_recipient`}
                    address={fee.recipient}
                    displayType='address-only'
                    scope={scope}
                />
            </PWView>
        </KeyValueRow>
    )
}
