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

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import {
    hasSigningKeys,
    isHardwareWalletAccount,
    isMultisigAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    SignableGroup,
    SigningResult,
    SourceCallbacks,
    SourceMetadata,
} from '../pipeline/types'
import {
    CannotSignError,
    HardwareWalletError,
    SigningError,
} from '../pipeline/errors'
import {
    validateCosignSubsetIntegrity,
    validateTransactionGroupIntegrity,
} from '../utils/validateTransactionGroupIntegrity'
import { resolveSigningAccount } from './utils/resolveSigningAccount'
import type {
    GroupSignerTypeMap,
    ResolvedSignerType,
    SigningMachineContext,
    SigningMachineDeps,
    SigningMachineInput,
} from './context'
import type { SignRequest } from '../models'
import {
    isTransactionRequest,
    isArbitraryDataRequest,
    isArc60Request,
} from '../models'

/**
 * Routes on the AUTH account — whatever actually authorizes the signature once
 * {@link resolveSigningAccount} has applied the rekey/cosign rules, not the
 * sender. That also covers the externally-rekeyed multisig (one whose on-chain
 * auth is a standard/Ledger account we hold): the auth key signs, rather than
 * failing with NoLocalParticipantsError.
 */
const determineSignerType = (
    signerAccount: WalletAccount,
    authAccount: WalletAccount,
): ResolvedSignerType => {
    if (isMultisigAccount(authAccount)) {
        return 'multisig'
    }
    if (isHardwareWalletAccount(authAccount)) {
        return 'hardware'
    }
    if (hasSigningKeys(authAccount)) {
        return 'localKey'
    }
    throw new CannotSignError(
        signerAccount.address,
        `No signing capability found for account type: ${authAccount.type}`,
    )
}

/** Rekey and multisig-cosign handling live in {@link resolveSigningAccount}. */
export const buildGroupSignerTypeMap = (
    groups: SignableGroup[],
    allAccounts: WalletAccount[],
): GroupSignerTypeMap => {
    const map: GroupSignerTypeMap = new Map()
    for (const group of groups) {
        if (map.has(group.signerAddress)) continue
        const signerAccount = allAccounts.find(
            a => a.address === group.signerAddress,
        )
        if (!signerAccount) {
            throw new CannotSignError(
                group.signerAddress,
                'signer account not found in wallet',
            )
        }
        const authAccount = resolveSigningAccount(
            signerAccount,
            group.source,
            group.data.type,
            allAccounts,
        )
        map.set(
            group.signerAddress,
            determineSignerType(signerAccount, authAccount),
        )
    }
    return map
}

/**
 * Dispatches on the tagged fields (`sourceType`, `transport`), NOT on whether an
 * `approve` callback happens to be present, so the selector stays predictable
 * as new caller shapes appear.
 *
 * Delivery needs no quantum special-casing: a PQ signature is a `pqsig` field
 * on the same `PeraSignedTransaction`, not a separate carrier, so it reaches
 * the request's `approve` unchanged. Whether the dApp's node accepts a Falcon
 * signature is network-gated, not a wallet concern.
 */
const buildSourceMetadata = (request: SignRequest): SourceMetadata => {
    const sourceType = request.sourceType ?? 'local'
    const isLocalAlgod =
        sourceType === 'local' && request.transport !== 'callback'

    if (isLocalAlgod) {
        return { type: 'local' }
    }

    if (sourceType === 'multisig-cosign') {
        if (!request.signRequestId) {
            throw new SigningError(
                'multisig-cosign request requires signRequestId on the SignRequest',
            )
        }
        return {
            type: 'multisig-cosign',
            signRequestId: request.signRequestId,
            requestId: request.transportId ?? request.id,
        }
    }

    // Local+callback and external sources both deliver via callbacks.
    // Wrap the typed request callback into the generic SourceCallbacks shape.
    let approveCallback: SourceCallbacks['approve']

    if (isTransactionRequest(request) && request.approve) {
        const txApprove = request.approve
        approveCallback = async (result: SigningResult) => {
            if (result.signedData.type === 'transactions') {
                await txApprove(result.signedData.signed)
            }
        }
    } else if (
        (isArbitraryDataRequest(request) || isArc60Request(request)) &&
        request.approve
    ) {
        const dataApprove = request.approve
        approveCallback = async (result: SigningResult) => {
            if (result.signedData.type === 'arbitrary-data') {
                // Every item shares one signer (enforced at build time) and is
                // signed by that single resolved account, so attribute all
                // signatures to it — not signers[i], which is undefined past
                // the first item.
                const signer = result.signers[0]?.address ?? ''
                await dataApprove(
                    result.signedData.signatures.map(signature => ({
                        signature,
                        signer,
                    })),
                )
            } else if (result.signedData.type === 'arc60') {
                // ARC-60 produces a single signature; project the result
                // through the same `[{ signature, signer }]` shape so the
                // callback consumer (WalletConnect bridge) doesn't need to
                // branch on the modality.
                await dataApprove([
                    {
                        signature: result.signedData.signature,
                        signer: result.signers[0]?.address ?? '',
                    },
                ])
            }
        }
    }

    return {
        type: sourceType,
        transport: request.transport,
        transportOptions: request.transportOptions,
        requestId: request.transportId ?? request.id,
        verifiedOrigin: request.verifiedOrigin,
        callbacks: {
            approve: approveCallback,
            reject: 'reject' in request ? request.reject : undefined,
            error: 'error' in request ? request.error : undefined,
            // Multisig sync-flow handoff: thread the transaction-only
            // delivery callback so createMultisigProposeTransport can
            // register it. soft-reject is delivered via `reject` with
            // `{ kind: 'softReject', error }`.
            approveSignedBytes: isTransactionRequest(request)
                ? request.approveSignedBytes
                : undefined,
            // Multisig propose handoff: lets the swap proposer capture the
            // backend signRequestId once the request is created.
            onProposed: isTransactionRequest(request)
                ? request.onProposed
                : undefined,
        },
    }
}

/**
 * Groups transactions by sender so each can be signed by the right account,
 * preserving positions in `originalIndices` for reassembly afterwards.
 *
 * Transactions whose effective signer isn't in `allAccounts` are silently
 * skipped — a no-op for local sources, and how external ones handle a dApp
 * sending contract-signed transactions mixed in with user-signed ones.
 */
const buildSignableGroups = (
    request: SignRequest,
    allAccounts: WalletAccount[],
): SignableGroup[] => {
    const source = buildSourceMetadata(request)

    if (isTransactionRequest(request)) {
        // Group integrity is checked over the full payload: sources that filter
        // `txs` supply the original via `groupContext`, others fall back to
        // `txs`.
        //
        // Multisig co-sign is the exception — the co-signer only holds the
        // signable subset, so the full-group hash can't match. Its validator
        // skips the recompute; contiguity is still enforced, and full-group
        // integrity is verified on the submitter and by algod.
        const txsToValidate = request.groupContext ?? request.txs
        if (request.sourceType === 'multisig-cosign') {
            validateCosignSubsetIntegrity(txsToValidate)
        } else {
            validateTransactionGroupIntegrity(txsToValidate)
        }

        const knownAddresses = new Set(allAccounts.map(a => a.address))
        const rawBytes = request.rawTransactionsBase64

        // Group transactions by sender, preserving original position
        const bySender = new Map<
            string,
            { txs: typeof request.txs; indices: number[] }
        >()
        for (const [i, tx] of request.txs.entries()) {
            const addr = request.signerOverrides?.get(i) ?? tx.sender.toString()

            // Skip transactions whose signer is not a known account
            if (!knownAddresses.has(addr)) continue

            if (!bySender.has(addr)) {
                bySender.set(addr, { txs: [], indices: [] })
            }
            const entry = bySender.get(addr)!
            entry.txs.push(tx)
            entry.indices.push(i)
        }

        return [...bySender.entries()].map(([addr, { txs, indices }]) => ({
            data: {
                type: 'transactions' as const,
                transactions: txs,
                indicesToSign: txs.map((_, i) => i),
                ...(rawBytes && {
                    rawTransactionsBase64: indices.map(i => rawBytes[i]),
                }),
            },
            source,
            signerAddress: addr,
            originalIndices: indices,
        }))
    }

    if (isArbitraryDataRequest(request)) {
        const firstData = request.data[0]
        if (!firstData) {
            throw new Error('No data in request')
        }
        // The whole group is bound to firstData.signer and signed with that one
        // account. Reject requests whose items claim different signers rather
        // than silently signing them with the first signer's key.
        if (request.data.some(item => item.signer !== firstData.signer)) {
            throw new CannotSignError(
                firstData.signer,
                'Arbitrary-data items must all share the same signer',
            )
        }
        return [
            {
                data: {
                    type: 'arbitrary-data',
                    data: request.data,
                },
                source,
                signerAddress: firstData.signer,
            },
        ]
    }

    if (isArc60Request(request)) {
        return [
            {
                data: {
                    type: 'arc60',
                    stdSigData: request.stdSigData,
                    metadata: request.metadata,
                },
                source,
                signerAddress: request.stdSigData.signer,
            },
        ]
    }

    const exhaustiveCheck: never = request
    throw new Error(
        `Unsupported request type: ${(exhaustiveCheck as { type: string }).type}`,
    )
}

/** Keeps dependency wiring out of the context factories. */
const extractDeps = (input: SigningMachineInput): SigningMachineDeps => ({
    signTransactions: input.signTransactions,
    signArbitraryData: input.signArbitraryData,
    signArc60: input.signArc60,
    createTransport: input.createTransport,
    network: input.network,
    encodeTransaction: input.encodeTransaction,
    hardwareWalletRegistry: input.hardwareWalletRegistry,
})

/**
 * Throws if the signer can't be found or can't sign. Only the primary
 * signerAddress is stored — actors resolve the full account at signing time, so
 * multi-signer requests can look up per group.
 */
export const resolveInitialContext = (
    input: SigningMachineInput,
): SigningMachineContext => {
    const { request, allAccounts } = input

    const signableGroups = buildSignableGroups(request, allAccounts)

    if (signableGroups.length === 0) {
        throw new CannotSignError(
            'unknown',
            'No signable transactions found in request',
        )
    }

    const signerAddress = signableGroups[0].signerAddress
    const groupSignerTypes = buildGroupSignerTypeMap(
        signableGroups,
        allAccounts,
    )

    const hasHardwareSigners = [...groupSignerTypes.values()].includes(
        'hardware',
    )
    if (hasHardwareSigners && !input.hardwareWalletRegistry) {
        throw new HardwareWalletError('registry_required')
    }

    return {
        request,
        allAccounts,
        signerAddress,
        groupSignerTypes,
        completedSignerTypes: [],
        signableGroups,
        analyses: null,
        signingResults: null,
        transportResult: null,
        error: null,
        failedDuringState: null,
        signerSnapshotTick: 0,
        deps: extractDeps(input),
    }
}

/**
 * Builds a failed context for when resolveInitialContext throws.
 * The machine starts in `idle` and immediately transitions to `failed`.
 */
export const makeFailedContext = (
    input: SigningMachineInput,
    error: Error,
): SigningMachineContext => ({
    request: input.request,
    allAccounts: input.allAccounts,
    signerAddress: null,
    groupSignerTypes: null,
    completedSignerTypes: [],
    signableGroups: null,
    analyses: null,
    signingResults: null,
    transportResult: null,
    error,
    failedDuringState: null,
    signerSnapshotTick: 0,
    deps: extractDeps(input),
})
