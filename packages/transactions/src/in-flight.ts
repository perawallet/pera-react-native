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

import { isSameAddress } from '@perawallet/wallet-core-accounts'
import type {
    ChainScope,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import {
    getOpenSubmissionSpends,
    type OpenSubmissionSpend,
} from '@perawallet/wallet-core-signing'
import type { InFlightSpend } from './transfer-adapter'

// A self-send still counts: a node prices a sender's queued transactions
// together against its balance, whoever receives them.
const outflowsOf = (summary: TransactionSummary): InFlightSpend['outflows'] => {
    if (summary.balanceChanges) {
        return summary.balanceChanges
            .filter(change => change.value.isNegative())
            .map(({ assetRef, value }) => ({ assetRef, value: value.neg() }))
    }
    if (
        summary.amount &&
        (summary.direction === 'out' || summary.direction === 'self')
    ) {
        const { assetRef, value } = summary.amount
        return [{ assetRef, value }]
    }
    return []
}

const toInFlightSpend = ({
    nonce,
    maxFee,
    historyEntry,
}: OpenSubmissionSpend): InFlightSpend => ({
    ...(nonce !== null && { nonce }),
    ...(maxFee !== null && { maxFee }),
    outflows: historyEntry ? outflowsOf(historyEntry.summary) : [],
})

export type GetInFlightSpendsParams = {
    address: string
    scope: ChainScope
}

/** The open attempts `address` sent in `scope`. Reads SQLite only, so it answers offline. */
export const getInFlightSpends = async ({
    address,
    scope,
}: GetInFlightSpendsParams): Promise<InFlightSpend[]> => {
    const attempts = await getOpenSubmissionSpends({ scope })
    return attempts
        .filter(
            ({ sender }) =>
                sender !== null &&
                isSameAddress(scope.chainId, sender, address),
        )
        .map(toInFlightSpend)
}
