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

import { Decimal } from 'decimal.js'
import { isSameAddress } from '@perawallet/wallet-core-accounts'
import type {
    ChainScope,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import {
    getUnsyncedSubmissionSpends,
    type UnsyncedSubmissionSpend,
} from '@perawallet/wallet-core-signing'
import type { Nullable } from '@perawallet/wallet-core-shared'
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
}: UnsyncedSubmissionSpend): InFlightSpend => ({
    ...(nonce !== null && { nonce }),
    ...(maxFee !== null && { maxFee }),
    outflows: historyEntry ? outflowsOf(historyEntry.summary) : [],
})

const higherOf = (
    a: Nullable<Decimal>,
    b: Nullable<Decimal>,
): Nullable<Decimal> => (a && b ? Decimal.max(a, b) : (a ?? b))

// A speed-up or cancel re-prices its original at the same nonce and only one
// of them can be mined, so the nonce spends once: what the attempt nothing
// re-prices spends, unless one already landed, at the highest fee of any.
const oneAtEachNonce = (
    attempts: readonly UnsyncedSubmissionSpend[],
): UnsyncedSubmissionSpend[] => {
    const groups = new Map<number | string, UnsyncedSubmissionSpend[]>()
    for (const attempt of attempts) {
        const key = attempt.nonce ?? attempt.id
        groups.set(key, [...(groups.get(key) ?? []), attempt])
    }
    return [...groups.values()].map(group => {
        const replaced = new Set(group.map(a => a.replacesAttemptId))
        const spent =
            group.find(({ status }) => status === 'confirmed') ??
            group.filter(({ id }) => !replaced.has(id)).at(-1) ??
            group.at(-1)!
        return {
            ...spent,
            maxFee: group.reduce<Nullable<Decimal>>(
                (highest, { maxFee }) => higherOf(highest, maxFee),
                null,
            ),
        }
    })
}

export type GetInFlightSpendsParams = {
    address: string
    scope: ChainScope
}

/** The attempts `address` sent in `scope` that its synced balance may not reflect. Reads SQLite only, so it answers offline. */
export const getInFlightSpends = async ({
    address,
    scope,
}: GetInFlightSpendsParams): Promise<InFlightSpend[]> => {
    const attempts = await getUnsyncedSubmissionSpends({ scope })
    return oneAtEachNonce(
        attempts.filter(
            ({ sender }) =>
                sender !== null &&
                isSameAddress(scope.chainId, sender, address),
        ),
    ).map(toInFlightSpend)
}
