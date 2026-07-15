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

import { decodeFromBase64 } from '@perawallet/wallet-core-shared'
import type {
    PeraSignedTransaction,
    PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import type {
    SerializedGroupPlan,
    TransactionGroup,
} from '@perawallet/wallet-core-swaps'

/**
 * A slot in a group's submission order. Either a backend pre-signed
 * transaction (passed straight through to algod) or a placeholder pointing
 * into the flat unsigned-transactions array that the signing pipeline fills in.
 */
export type GroupSlot =
    | { kind: 'preSigned'; signed: PeraSignedTransaction }
    | { kind: 'toSign'; flatIndex: number }

export type GroupPlan = {
    slots: GroupSlot[]
}

export type BuildGroupPlansResult = {
    plans: GroupPlan[]
    unsignedTxs: PeraTransaction[]
    // Full ordered list of every txn across every group (pre-signed slots
    // contribute their inner unsigned-form), passed to the signing pipeline
    // as `groupContext` so `validateTransactionGroupIntegrity` can recompute
    // the group hash over the same payload the backend signed.
    groupContext: PeraTransaction[]
}

type GroupDecoders = {
    decodeTransaction: (bytes: Uint8Array) => PeraTransaction
    decodeSignedTransaction: (bytes: Uint8Array) => PeraSignedTransaction
}

/**
 * Decode every group up-front into a merge plan and collect the unsigned
 * transactions the user must sign into a single flat array.
 *
 * signed_transactions and transactions are parallel arrays:
 * - signed_transactions[i] is a pre-signed base64 string, or null if user must sign
 * - transactions[i] is an unsigned base64 string, or null if already signed
 */
export const buildGroupPlans = (
    groups: TransactionGroup[],
    { decodeTransaction, decodeSignedTransaction }: GroupDecoders,
): BuildGroupPlansResult => {
    const plans: GroupPlan[] = []
    const unsignedTxs: PeraTransaction[] = []
    const groupContext: PeraTransaction[] = []

    for (const group of groups) {
        const signed = group.signedTransactions ?? []
        const unsigned = group.transactions ?? []
        const length = Math.max(signed.length, unsigned.length)
        const slots: GroupSlot[] = []

        for (let i = 0; i < length; i++) {
            const signedEntry = signed[i]
            const unsignedEntry = unsigned[i]
            if (signedEntry) {
                const bytes = decodeFromBase64(signedEntry)
                const signedTxn = decodeSignedTransaction(bytes)
                slots.push({ kind: 'preSigned', signed: signedTxn })
                groupContext.push(signedTxn.txn)
            } else if (unsignedEntry) {
                const bytes = decodeFromBase64(unsignedEntry)
                const flatIndex = unsignedTxs.length
                const unsignedTxn = decodeTransaction(bytes)
                unsignedTxs.push(unsignedTxn)
                groupContext.push(unsignedTxn)
                slots.push({ kind: 'toSign', flatIndex })
            }
        }

        plans.push({ slots })
    }

    return { plans, unsignedTxs, groupContext }
}

/**
 * Scatter the flat array of user-signed transactions back into their
 * original per-group submission order, interleaved with pre-signed slots.
 */
export const scatterSigned = (
    plans: GroupPlan[],
    flatSigned: PeraSignedTransaction[],
): PeraSignedTransaction[][] =>
    plans.map(plan =>
        plan.slots.map(slot =>
            slot.kind === 'preSigned'
                ? slot.signed
                : flatSigned[slot.flatIndex],
        ),
    )

/**
 * Serialize the submission plans for persistence in the swap-handoff store.
 * Pre-signed slots are encoded to base64 (no `PeraSignedTransaction` in
 * persisted state); to-sign slots keep their flat index, which the resolver
 * later fills from the assembled composite-multisig bytes.
 */
export const serializeGroupPlans = (
    plans: GroupPlan[],
    encodeSignedTransactions: (txns: PeraSignedTransaction[]) => Uint8Array[],
    encodeToBase64: (bytes: Uint8Array) => string,
): SerializedGroupPlan[] =>
    plans.map(plan => ({
        slots: plan.slots.map(slot =>
            slot.kind === 'preSigned'
                ? {
                      kind: 'preSigned' as const,
                      signedTxnBase64: encodeToBase64(
                          encodeSignedTransactions([slot.signed])[0],
                      ),
                  }
                : { kind: 'toSign' as const, flatIndex: slot.flatIndex },
        ),
    }))

/**
 * Sentinel error so the swap execution flow can distinguish a user-initiated
 * cancel from a real signing failure (and skip the backend failure report).
 */
export class SwapUserRejectedError extends Error {
    constructor() {
        super('User rejected swap signing')
        this.name = 'SwapUserRejectedError'
    }
}
