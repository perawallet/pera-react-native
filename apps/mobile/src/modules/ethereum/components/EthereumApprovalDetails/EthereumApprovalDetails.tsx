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

import { PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    CollectionApprovalWarning,
    SpendApprovalWarning,
} from '@modules/signing'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { GrantRows } from './GrantRows'
import { useStyles } from './styles'

type EthereumApprovalDetailsProps = {
    presentation: EthereumTransactionPresentation
}

export const EthereumApprovalDetails = ({
    presentation,
}: EthereumApprovalDetailsProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { standardCall, scope } = presentation

    let content = null
    if (standardCall?.kind === 'token-approval') {
        content = standardCall.spendApproval ? (
            <SpendApprovalWarning
                approval={standardCall.spendApproval}
                scope={scope}
            />
        ) : (
            <GrantRows
                spenderTitle={t('signing.spend_approval.spender_label')}
                spender={standardCall.spender}
                contract={standardCall.contract}
                isRevocation
            />
        )
    } else if (standardCall?.kind === 'collection-approval') {
        content = standardCall.isApproved ? (
            <CollectionApprovalWarning
                operator={standardCall.operator}
                collection={standardCall.contract}
            />
        ) : (
            <GrantRows
                spenderTitle={t('signing.collection_approval.operator_label')}
                spender={standardCall.operator}
                contract={standardCall.contract}
                isRevocation
            />
        )
    } else if (standardCall?.kind === 'nft-approval') {
        content = (
            <GrantRows
                spenderTitle={t('signing.spend_approval.spender_label')}
                spender={standardCall.spender}
                assetText={t('transactions.list_item.nft_subtitle', {
                    collection:
                        standardCall.collectionName ?? standardCall.contract,
                    tokenId: standardCall.tokenId,
                })}
                contract={standardCall.contract}
                isRevocation={standardCall.isRevocation}
            />
        )
    }

    return <PWView style={styles.container}>{content}</PWView>
}
