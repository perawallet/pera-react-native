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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { TransactionDetailLayout, type DetailBodyProps } from '@modules/signing'
import { EthereumTransactionDetailSection } from '../EthereumTransactionDetailSection'
import { useEthereumTransactionDetailBody } from './useEthereumTransactionDetailBody'

export type EthereumTransactionDetailBodyProps = DetailBodyProps & {
    /** The chain the transaction is on; unset, the selected Ethereum scope. */
    scope?: ChainScope
}

export const EthereumTransactionDetailBody = ({
    transaction,
    scope,
}: EthereumTransactionDetailBodyProps) => {
    const { presentation, summary, source, verifiedOrigin } =
        useEthereumTransactionDetailBody(transaction, scope)

    if (!presentation || !summary) {
        return null
    }

    return (
        <TransactionDetailLayout
            summary={summary}
            chainSection={
                <EthereumTransactionDetailSection
                    presentation={presentation}
                    source={source}
                    verifiedOrigin={verifiedOrigin}
                />
            }
        />
    )
}
