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

import {
    findAccountByAddressOn,
    isSameAddress,
    signingKeyOn,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    transactionPlanners,
    type ChainKeyStore,
    type ChainScope,
    type Signature,
    type SignedTransaction,
    type SigningRequest,
    type TransactionPlanner,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { SIGNING_KEY_DOMAIN } from '../../../constants'
import {
    CannotSignError,
    InvalidSignableDataError,
    SigningError,
} from '../../../pipeline/errors'
import {
    isUnsignedTransactionsData,
    type AnalyzedSignableGroup,
    type SigningResult,
} from '../../../pipeline/types'
import { resolveSignerCredential } from '../../utils/resolveSignerCredential'

export type PlannedSignerInput = {
    groups: AnalyzedSignableGroup[]
    allAccounts: WalletAccount[]
    scope: ChainScope
    keyStore: Pick<ChainKeyStore, 'sign'>
}

/** Signs chain-neutral groups through their chain's planner (see docs/ARCHITECTURE.md). */
export const signPlannedGroups = async ({
    groups,
    allAccounts,
    scope,
    keyStore,
}: PlannedSignerInput): Promise<SigningResult[]> => {
    const planner = transactionPlanners.get(scope.chainId)

    // Only keys the review listed sign, so a payload can't add a signer the
    // user never approved. A listed key the wallet can't use here is left to
    // its holder; the planner can't recover a signer, so the scheme must match.
    const keyFor = (
        request: SigningRequest,
        reviewed: readonly string[],
    ): string | undefined => {
        if (
            !reviewed.some(address =>
                isSameAddress(scope.chainId, address, request.signer),
            )
        ) {
            return undefined
        }
        const account = findAccountByAddressOn(
            allAccounts,
            scope.chainId,
            request.signer,
        )
        const keyPairId = account && signingKeyOn(account, scope.chainId)
        if (!account || account.custody.kind !== 'local' || !keyPairId) {
            return undefined
        }
        if (
            resolveSignerCredential(account, scope.chainId).scheme !==
            request.scheme
        ) {
            throw new CannotSignError(
                request.signer,
                `no ${request.scheme} key on this chain`,
            )
        }
        return keyPairId
    }

    const signTransaction = async (
        transaction: UnsignedTransaction,
        group: AnalyzedSignableGroup,
    ): Promise<SignedTransaction> => {
        // Every key is resolved before any signs, so a refusal signs nothing.
        const held = planOrRefuse(planner, transaction).flatMap(request => {
            const keyPairId = keyFor(request, group.analysis.signableAddresses)
            return keyPairId ? [{ request, keyPairId }] : []
        })
        if (held.length === 0) {
            throw new CannotSignError(
                group.signerAddress,
                'the wallet holds none of the keys this transaction needs',
            )
        }
        const signatures: Signature[] = []
        for (const { request, keyPairId } of held) {
            signatures.push({
                requestIndex: request.requestIndex,
                signer: request.signer,
                scheme: request.scheme,
                bytes: await keyStore.sign(
                    keyPairId,
                    request.payload,
                    SIGNING_KEY_DOMAIN,
                ),
            })
        }
        return assembleOrRefuse(planner, transaction, signatures)
    }

    const results: SigningResult[] = []
    for (const group of groups) {
        if (
            group.data.type !== 'transactions' ||
            !isUnsignedTransactionsData(group.data)
        ) {
            throw new InvalidSignableDataError(
                'only chain-neutral transactions are signed through a planner',
            )
        }
        const signed: SignedTransaction[] = []
        for (const transaction of group.data.transactions) {
            signed.push(await signTransaction(transaction, group))
        }
        const historyEntries = group.data.transactions.map(
            ({ summary, chainData }) => ({ summary, chainData }),
        )
        results.push({
            signedData: { type: 'signed-transactions', signed, historyEntries },
            signers: [{ address: group.signerAddress }],
            originalIndices: group.originalIndices,
        })
    }
    return results
}

const messageOf = (error: unknown): string =>
    error instanceof Error ? error.message : String(error)

const planOrRefuse = (
    planner: TransactionPlanner,
    transaction: UnsignedTransaction,
): SigningRequest[] => {
    try {
        return planner.plan(transaction)
    } catch (error) {
        throw new InvalidSignableDataError(messageOf(error))
    }
}

// The same signatures assemble the same way, so retrying can't help.
const assembleOrRefuse = async (
    planner: TransactionPlanner,
    transaction: UnsignedTransaction,
    signatures: Signature[],
): Promise<SignedTransaction> => {
    try {
        return await planner.assemble(transaction, signatures)
    } catch (error) {
        throw new SigningError(
            messageOf(error),
            error instanceof Error ? error : undefined,
            { retryable: false },
        )
    }
}
