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
    chainAccountOf,
    isSameAddress,
    type HardwareWalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    transactionPlanners,
    type ChainScope,
    type Signature,
    type SignedTransaction,
    type TransactionPlanner,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import { LEDGER_CONFIRMATION_TIMEOUT_MS } from '@perawallet/wallet-core-ledger'
import {
    encodeToBase64,
    withTimeout,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import {
    CannotSignError,
    InvalidSignableDataError,
} from '../../../pipeline/errors'
import {
    ledgerTimeoutReason,
    throwIfAborted,
    withLedgerSession,
} from '../../../pipeline/signing/withLedgerSession'
import type {
    AnalyzedSignableGroup,
    SignedData,
    SigningCallbacks,
    SigningResult,
} from '../../../pipeline/types'
import { assembleOrRefuse, planOrRefuse } from './signPlannedGroups'

export type PlannedDeviceSigningInput = {
    group: AnalyzedSignableGroup
    /** The account whose device signs: the group's signer, or the authority it is rekeyed to. */
    account: HardwareWalletAccount
    scope: ChainScope
    registry?: HardwareWalletRegistry
    callbacks?: SigningCallbacks
}

/**
 * Signs a group of chain-neutral transactions on the account's device: each
 * planned request the device holds is signed over its `devicePayload`, then
 * the chain's planner assembles the transaction. Session failures reach
 * `callbacks.onError` classified.
 */
export const signPlannedGroupOnDevice = async ({
    group,
    account,
    scope,
    registry,
    callbacks,
}: PlannedDeviceSigningInput): Promise<SigningResult> => {
    const { data } = group
    if (data.type !== 'transactions') {
        throw new InvalidSignableDataError(
            'only chain-neutral transactions are signed through a planner',
        )
    }
    const { chainId } = scope
    const address = chainAccountOf(account, chainId)?.address
    if (!address) {
        throw new CannotSignError('', `Account has no address on ${chainId}`)
    }
    const isCosign = group.source.type === 'multisig-cosign'
    const planner = transactionPlanners.get(chainId)

    // Every request is resolved before the session opens, so a transaction
    // the device can't sign is refused without a device prompt.
    const requestsByTransaction = data.transactions.map(transaction => {
        const held = planOrRefuse(planner, transaction).filter(
            request =>
                group.analysis.signableAddresses.some(reviewed =>
                    isSameAddress(chainId, reviewed, request.signer),
                ) && isSameAddress(chainId, request.signer, address),
        )
        if (held.length === 0) {
            throw new CannotSignError(
                group.signerAddress,
                'the device holds none of the keys this transaction needs',
            )
        }
        // A cosigning participant adds its one signature to the request.
        return (isCosign ? held.slice(0, 1) : held).map(request => {
            const { devicePayload } = request
            if (!devicePayload) {
                throw new InvalidSignableDataError(
                    'the planner gave no bytes for a device to sign',
                )
            }
            return { ...request, devicePayload }
        })
    })

    const signaturesByTransaction = await withLedgerSession(
        account,
        address,
        { registry, callbacks, chainId },
        async ({ transport, guard }) => {
            const { accountIndex } = account.custody
            const total = requestsByTransaction.length
            const signed: Signature[][] = []

            callbacks?.onSigningStart?.()
            for (const [index, requests] of requestsByTransaction.entries()) {
                // No APDU leaves the app after an abort: the detached loop
                // would otherwise prompt for every remaining transaction.
                throwIfAborted(callbacks?.signal)
                callbacks?.onProgress?.(index + 1, total)

                const signatures: Signature[] = []
                for (const request of requests) {
                    callbacks?.onPhaseChange?.('awaiting-approval')
                    // CONFIRMATION, not CONNECTION: the user is reading the
                    // transaction on the device. The ceiling only stops a
                    // dropped link hanging the promise.
                    const bytes = await withTimeout(
                        guard.race(
                            transport.signTransaction(
                                accountIndex,
                                request.devicePayload,
                            ),
                        ),
                        LEDGER_CONFIRMATION_TIMEOUT_MS,
                        'Sign Ledger transaction',
                        ledgerTimeoutReason('Sign Ledger transaction'),
                    )
                    signatures.push({
                        requestIndex: request.requestIndex,
                        signer: request.signer,
                        scheme: request.scheme,
                        bytes,
                    })
                }
                signed.push(signatures)
            }
            callbacks?.onSigningComplete?.()
            return signed
        },
    )

    return {
        signedData: await signedDataOf(
            planner,
            group,
            data.transactions,
            signaturesByTransaction,
        ),
        signers: [
            {
                address,
                // The multisig cosign transport posts these as the
                // participant's signatures; the backend rejects a cosign
                // without them.
                signatures: signaturesByTransaction.map(
                    (signatures): Nullable<string> =>
                        signatures[0]
                            ? encodeToBase64(signatures[0].bytes)
                            : null,
                ),
            },
        ],
        originalIndices: group.originalIndices,
    }
}

const signedDataOf = async (
    planner: TransactionPlanner,
    group: AnalyzedSignableGroup,
    transactions: UnsignedTransaction[],
    signaturesByTransaction: Signature[][],
): Promise<SignedData> => {
    // A cosign adds this participant's signatures to a request the backend
    // assembles; its transport reads only `signers`.
    if (group.source.type === 'multisig-cosign') {
        return { type: 'transactions', signed: [] }
    }
    const signed: SignedTransaction[] = []
    for (const [index, transaction] of transactions.entries()) {
        signed.push(
            await assembleOrRefuse(
                planner,
                transaction,
                signaturesByTransaction[index],
            ),
        )
    }
    // A group that shares a request with the chain's own signers is merged
    // with their results, which carry no history entries.
    if (group.shouldUseChainSigner) {
        return { type: 'transactions', signed }
    }
    return {
        type: 'signed-transactions',
        signed,
        historyEntries: transactions.map(({ summary, chainData }) => ({
            summary,
            chainData,
        })),
    }
}
