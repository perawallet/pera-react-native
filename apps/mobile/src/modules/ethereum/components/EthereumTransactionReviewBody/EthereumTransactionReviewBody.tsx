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

import { TransactionReviewLayout, type ReviewBodyProps } from '@modules/signing'
import { useEthereumTransactionPresentation } from '../../hooks/useEthereumTransactionPresentation'
import { EthereumTransactionReview } from './EthereumTransactionReview'

export const EthereumTransactionReviewBody = ({
    transaction,
    source,
    verifiedOrigin,
    actions,
}: ReviewBodyProps) => {
    const presentation = useEthereumTransactionPresentation(transaction)

    if (!presentation) {
        return <TransactionReviewLayout actions={actions} />
    }

    return (
        <EthereumTransactionReview
            transaction={transaction}
            presentation={presentation}
            source={source}
            verifiedOrigin={verifiedOrigin}
            actions={actions}
        />
    )
}
