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

import { readAlgorandNative } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { TransactionReviewLayout, type ReviewBodyProps } from '@modules/signing'
import { AlgorandTransactionReview } from './AlgorandTransactionReview'

export const AlgorandTransactionReviewBody = ({
    transaction,
    source,
    verifiedOrigin,
    actions,
}: ReviewBodyProps) => {
    const view = readAlgorandNative(transaction)

    if (!view) {
        return <TransactionReviewLayout actions={actions} />
    }

    return (
        <AlgorandTransactionReview
            transaction={transaction}
            view={view}
            source={source}
            verifiedOrigin={verifiedOrigin}
            actions={actions}
        />
    )
}
