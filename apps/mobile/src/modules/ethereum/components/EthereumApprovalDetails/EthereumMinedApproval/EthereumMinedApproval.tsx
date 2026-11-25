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

import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { EthereumTransactionPresentation } from '@modules/ethereum/hooks/useEthereumTransactionPresentation'
import { useStyles } from './styles'
import { useEthereumMinedApproval } from './useEthereumMinedApproval'

type EthereumMinedApprovalProps = {
    presentation: EthereumTransactionPresentation
}

export const EthereumMinedApproval = ({
    presentation,
}: EthereumMinedApprovalProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { grantText, handleOpenTokenApprovals } =
        useEthereumMinedApproval(presentation)

    if (!grantText) return null

    return (
        <PWView
            style={styles.container}
            testID='ethereum_mined_approval'
        >
            <PWText testID='ethereum_mined_approval_text'>{grantText}</PWText>
            {!!handleOpenTokenApprovals && (
                <PWButton
                    variant='link'
                    paddingStyle='none'
                    title={t('transactions.record_detail.manage_approvals')}
                    onPress={handleOpenTokenApprovals}
                    testID='ethereum_mined_approval_manage'
                />
            )}
        </PWView>
    )
}
