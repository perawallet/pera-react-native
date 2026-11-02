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

import type { TransactionRecord } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'

export type RecordParties = {
    from?: string
    to?: string
}

/** The parties a history record names, from the side of the account whose history it is in. */
export const recordPartiesOf = (
    record: TransactionRecord,
    ownAddress: string,
): RecordParties => {
    const { summary, initiator } = record
    const { counterparty, direction } = summary
    const own: Optional<string> = ownAddress || undefined
    // A self-send names its own address as counterparty and initiator alike,
    // so it must be told apart before the inbound test reads that as a call
    // another party made.
    if (direction === 'self') return { from: own, to: own }

    // The counterparty is the sender of a payment received, and of a call
    // another party made.
    const isInbound =
        direction === 'in' ||
        (!!initiator && counterparty?.toLowerCase() === initiator.toLowerCase())

    if (isInbound) return { from: counterparty, to: own }
    return {
        from: initiator ?? (direction === 'out' ? own : undefined),
        to: counterparty,
    }
}
