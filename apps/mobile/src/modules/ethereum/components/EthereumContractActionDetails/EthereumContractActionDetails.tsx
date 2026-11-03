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

import { hidesUnknownContractNotice } from '@perawallet/wallet-core-chain-ethereum'
import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { PWView } from '@components/core'
import { ChainNotice } from '@components/ChainNotice'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { contractCallNoticeOf } from '../EthereumContractCallDetails'
import { EthereumKnownContractRow } from '../EthereumKnownContractRow'
import { ActionRows } from './ActionRows'
import { useStyles } from './styles'

type EthereumContractActionDetailsProps = {
    presentation: EthereumTransactionPresentation
    /** `'review'` is the signing screen; `'detail'` reads a transaction already made. */
    variant: 'review' | 'detail'
    /** Read only on `'review'`. */
    source?: SignRequestSource
    /** Read only on `'review'`. Origin the platform observed (never dApp-asserted). */
    verifiedOrigin?: string
}

export const EthereumContractActionDetails = ({
    presentation,
    variant,
    source,
    verifiedOrigin,
}: EthereumContractActionDetailsProps) => {
    const styles = useStyles()
    const { view, scope, knownContract, contractAction } = presentation
    // The detail screen renders the notice with its raw call; only the review has no other place for it.
    const notice =
        variant === 'review' && !hidesUnknownContractNotice(view.action)
            ? contractCallNoticeOf(source, verifiedOrigin)
            : undefined

    return (
        <PWView style={styles.container}>
            {!!notice && (
                <ChainNotice
                    kind='warning'
                    titleKey={notice.titleKey}
                    params={notice.params}
                    testID='ethereum_contract_call_warning'
                />
            )}
            {!!knownContract && !!view.to && (
                <EthereumKnownContractRow
                    knownContract={knownContract}
                    address={view.to}
                    scope={scope}
                    source={source}
                    verifiedOrigin={verifiedOrigin}
                />
            )}
            {!!contractAction && (
                <ActionRows
                    action={contractAction}
                    presentation={presentation}
                />
            )}
        </PWView>
    )
}
