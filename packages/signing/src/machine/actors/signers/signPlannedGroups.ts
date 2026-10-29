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
import {
    AppError,
    isRetryableError,
    logger,
    toError,
} from '@perawallet/wallet-core-shared'
import { SIGNING_KEY_DOMAIN } from '../../../constants'
import {
    CannotSignError,
    InvalidSignableDataError,
    SIGNING_ERROR_KEYS,
    SigningError,
} from '../../../pipeline/errors'
import type {
    AnalyzedSignableGroup,
    SigningResult,
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
                bytes: await signOrReport(keyStore, keyPairId, request.payload),
            })
        }
        return assembleOrRefuse(planner, transaction, signatures)
    }

    const results: SigningResult[] = []
    for (const group of groups) {
        if (group.data.type !== 'transactions') {
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

const messageOf = (error: unknown): string => toError(error).message

// The same reporting the chain's own local-key signer gives a keystore fault,
// so the user sees the same copy whichever signer ran.
export const signOrReport = async (
    keyStore: Pick<ChainKeyStore, 'sign'>,
    keyPairId: string,
    payload: Uint8Array,
): Promise<Uint8Array> => {
    try {
        return await keyStore.sign(keyPairId, payload, SIGNING_KEY_DOMAIN)
    } catch (error) {
        const cause = toError(error)
        const causeKey =
            cause instanceof AppError ? cause.metadata.messageKey : undefined
        logger.error('Local-key signing failed', { error: cause })
        throw new SigningError(cause.message, cause, {
            retryable: isRetryableError(cause),
            messageKey: causeKey ?? SIGNING_ERROR_KEYS.localKeyFailed,
            params:
                causeKey && cause instanceof AppError
                    ? cause.metadata.params
                    : undefined,
        })
    }
}

export const planOrRefuse = (
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
export const assembleOrRefuse = async (
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
