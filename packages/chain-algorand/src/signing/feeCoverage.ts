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

import { modelsv2, SignedTransaction } from 'algosdk'
import {
    LEGACY_CHAIN_ID,
    type PeraTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    getSignerFor,
    usesNonPrimaryScheme,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { algorandAddressOf } from '../accounts/vocabulary'
import {
    bytesToHex,
    logger,
    withTimeout,
    type Network,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    Address,
    asAlgosdkTransaction,
    createWalletAlgorandClient,
} from '../blockchain'
import {
    emptySignatureFieldsOf,
    type EmptySignatureFields,
} from '../connect/emptySignatures'

// Runs before the review sheet shows; past it the group is bumped as if
// unchecked, which overpays rather than fails.
export const FEE_COVERAGE_TIMEOUT_MS = 3000

/** algod's failure message for the group, or `null` if it would pass. */
export type SimulateSignedGroup = (
    group: SignedTransaction[],
    network: Network,
) => Promise<Nullable<string>>

export const simulateSignedGroup: SimulateSignedGroup = async (
    group,
    network,
) => {
    const request = new modelsv2.SimulateRequest({
        txnGroups: [
            new modelsv2.SimulateRequestTransactionGroup({ txns: group }),
        ],
        allowEmptySignatures: true,
    })
    const response = await createWalletAlgorandClient(network)
        .client.algod.simulateTransactions(request)
        .do()
    return response.txnGroups[0]?.failureMessage ?? null
}

// Consecutive members sharing a group id; an ungrouped transaction stands alone.
const partitionIndices = (transactions: PeraTransaction[]): number[][] => {
    const partitions: number[][] = []
    let previousGroup: Nullable<string> = null
    transactions.forEach((txn, index) => {
        const group = txn.group ? bytesToHex(txn.group) : null
        const current = partitions.at(-1)
        if (current && group !== null && group === previousGroup) {
            current.push(index)
        } else {
            partitions.push([index])
        }
        previousGroup = group
    })
    return partitions
}

// The shape the signer's real signature will have, so algod charges what
// submission will: a `pqsig` costs the PQ multiple of the base fee. `null` when
// unknown, since guessing ed25519 would under-price a quantum signer.
const signedShapeOf = (
    txn: PeraTransaction,
    signer: Nullable<WalletAccount>,
): Nullable<SignedTransaction> => {
    const signerAddress = signer ? algorandAddressOf(signer) : undefined
    if (!signer || !signerAddress) return null
    let fields: Nullable<EmptySignatureFields>
    try {
        fields = emptySignatureFieldsOf(signer)
    } catch {
        return null
    }
    if (!fields) return null
    return new SignedTransaction({
        txn: asAlgosdkTransaction(txn),
        ...fields,
        ...(signerAddress === txn.sender.toString()
            ? {}
            : { sgnr: Address.fromString(signerAddress) }),
    })
}

export type FindFundedIndicesParams = {
    transactions: PeraTransaction[]
    signableIndices: number[]
    signerOverrides?: Map<number, string>
    accounts: WalletAccount[]
    network: Network
    simulate?: SimulateSignedGroup
    timeoutMs?: number
}

/**
 * Indices of the quantum-signed partitions whose fees already cover what their
 * signers cost: a dApp that simulated with this wallet's empty signatures has
 * priced the PQ premium in, and a second surcharge would overcharge it. Only a
 * clean simulation counts; any failure, error or timeout leaves the partition
 * to be bumped as before.
 */
export const findFundedIndices = async ({
    transactions,
    signableIndices,
    signerOverrides,
    accounts,
    network,
    simulate = simulateSignedGroup,
    timeoutMs = FEE_COVERAGE_TIMEOUT_MS,
}: FindFundedIndicesParams): Promise<ReadonlySet<number>> => {
    const subsetIndexOf = new Map(
        signableIndices.map((index, subsetIndex) => [index, subsetIndex]),
    )
    const signerAt = (index: number): Nullable<WalletAccount> => {
        const subsetIndex = subsetIndexOf.get(index)
        const authorizer =
            (subsetIndex === undefined
                ? undefined
                : signerOverrides?.get(subsetIndex)) ??
            transactions[index].sender.toString()
        return getSignerFor(authorizer, accounts, LEGACY_CHAIN_ID)
    }

    // A co-signed partition is never bumped, so it needs no check.
    const candidates = partitionIndices(transactions).filter(
        partition =>
            partition.every(index => subsetIndexOf.has(index)) &&
            partition.some(index => {
                const signer = signerAt(index)
                return (
                    signer !== null &&
                    usesNonPrimaryScheme(signer, LEGACY_CHAIN_ID)
                )
            }),
    )

    const check = async (): Promise<Set<number>> => {
        const funded = new Set<number>()
        for (const partition of candidates) {
            const group = partition.map(index =>
                signedShapeOf(transactions[index], signerAt(index)),
            )
            if (
                !group.every((stxn): stxn is SignedTransaction => stxn !== null)
            )
                continue
            if ((await simulate(group, network)) === null) {
                partition.forEach(index => funded.add(index))
            }
        }
        return funded
    }

    try {
        return await withTimeout(check(), timeoutMs, 'Fee coverage simulation')
    } catch (error) {
        logger.debug('Fee coverage check inconclusive; fees raised', {
            error,
        })
        return new Set()
    }
}
