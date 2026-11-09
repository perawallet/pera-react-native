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

import type { SignRequestSource } from '@perawallet/wallet-core-signing'
import { PWView } from '@components/core'
import type { EthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { EthereumKnownContractRow } from '../EthereumKnownContractRow'
import { ActionRows } from './ActionRows'
import { useStyles } from './styles'

type EthereumContractActionDetailsProps = {
    presentation: EthereumTransactionPresentation
    /** Set only on the review, which is the only place there is a request to match. */
    source?: SignRequestSource
    /** Set only on the review. Origin the platform observed (never dApp-asserted). */
    verifiedOrigin?: string
}

export const EthereumContractActionDetails = ({
    presentation,
    source,
    verifiedOrigin,
}: EthereumContractActionDetailsProps) => {
    const styles = useStyles()
    const { view, scope, knownContract, contractAction } = presentation

    return (
        <PWView style={styles.container}>
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
