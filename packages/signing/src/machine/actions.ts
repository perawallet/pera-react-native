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
    isQuantumAccount,
} from '@perawallet/wallet-core-accounts'
import {
    isQuantumSignedTransaction,
    type PeraSignedTransaction,
    type PeraSignedTxnResult,
} from '@perawallet/wallet-core-blockchain'
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

// =============================================================================
// Signer type resolution
// =============================================================================

/**
 * Determines the signing strategy type from the AUTH account — the account
 * whose key (or multisig template) actually authorizes the signature after
 * {@link resolveSigningAccount} applied the rekey/cosign rules:
 * - multisig: the auth account is a multisig (covers a multisig sender that
 *   self-resolves, a multisig rekeyed to another multisig, and any sender
 *   rekeyed on-chain to a Pera-held multisig)
 * - hardware: the auth account is a hardware wallet
 * - quantum: the auth account is a post-quantum (Falcon) account
 * - localKey: the auth account has local signing keys (Algo25 / HDWallet)
 *
 * Routing on the auth account also carries the externally-rekeyed-multisig
 * edge (a multisig whose on-chain auth is a standard/Ledger account we hold):
 * the auth key signs, instead of failing with NoLocalParticipantsError.
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
    // Quantum accounts carry a keyPairId, so this MUST run before the
    // hasSigningKeys check below — otherwise a Falcon account is swallowed
    // into the localKey path and mis-signed as a plain Ed25519 transaction.
    if (isQuantumAccount(authAccount)) {
        return 'quantum'
    }
    if (hasSigningKeys(authAccount)) {
        return 'localKey'
    }
    throw new CannotSignError(
        signerAccount.address,
        `No signing capability found for account type: ${authAccount.type}`,
    )
}

// =============================================================================
// Group signer type map
// =============================================================================

/**
 * Resolves the signing type for every unique signer address in the request.
 * Iterates all signable groups and determines the signer type per address,
 * enabling the machine to dispatch each group to the correct actor.
 *
 * Rekey vs. multisig-cosign handling is delegated to {@link resolveSigningAccount}.
 */
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
 * Narrows a signing result's `PeraSignedTxnResult[]` down to plain
 * `PeraSignedTransaction[]` for delivery to a `TransactionSignRequest.approve`
 * callback (WalletConnect / webview / deeplink / local-callback peers).
 *
 * Unlike the algod transport — which routes a quantum-signed group through
 * `submitAndAutoRefresh`'s synthetic MOCK(quantum) submission — callback
 * delivery hands signed bytes straight to an external peer with no node to
 * accept a Falcon signature yet. Throw a clear error instead of silently
 * mis-encoding the pqsig byte carrier as a plain signed transaction.
 */
export const assertNoQuantumSignedTransactions = (
    signed: PeraSignedTxnResult[],
): PeraSignedTransaction[] => {
    const quantumItem = signed.find(isQuantumSignedTransaction)
    if (quantumItem) {
        throw new SigningError(
            'Quantum-signed transactions cannot be delivered via the callback transport yet',
        )
    }
    return signed as PeraSignedTransaction[]
}

// =============================================================================
// SignableGroup construction
// =============================================================================

/**
 * Constructs {@link SourceMetadata} from a {@link SignRequest}.
 *
 * - Local requests with `transport: 'algod'` get a minimal metadata object;
 *   the transport layer submits the signed group directly to the network.
 * - Local requests with `transport: 'callback'` (e.g. swap) keep
 *   `type: 'local'` but carry `callbacks`, so the transport selector picks
 *   the callback transport and the caller receives the signed bytes.
 * - External sources (WalletConnect, webview, deeplink) always wire the
 *   request's approve/reject/error callbacks into the {@link SourceCallbacks}
 *   shape so the transport layer can notify the originator.
 *
 * Dispatch here is on the tagged fields (`sourceType`, `transport`) — not on
 * the runtime presence of an `approve` callback — so the selector stays
 * predictable as new caller shapes are added.
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
                await txApprove(
                    assertNoQuantumSignedTransactions(result.signedData.signed),
                )
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
 * Builds an array of signable groups from a sign request.
 *
 * For transaction requests, transactions are grouped by sender address so that
 * each group can be signed independently by the correct account. Original
 * positions are preserved in `originalIndices` to allow correct reassembly
 * after signing (see transportActor.mergeSigningResults).
 *
 * Transactions whose effective signer is not in `allAccounts` are silently
 * skipped. For local sources this is a no-op (the sender is always known);
 * for external sources it handles dApps that send mixed groups containing
 * contract-signed transactions alongside user-signed ones.
 *
 * For arbitrary-data requests, a single group is produced using the first
 * item's signer as the group's signerAddress.
 */
const buildSignableGroups = (
    request: SignRequest,
    allAccounts: WalletAccount[],
): SignableGroup[] => {
    const source = buildSourceMetadata(request)

    if (isTransactionRequest(request)) {
        // Validate atomic-group integrity over the full payload. External
        // sources that filter `txs` down to the wallet's signable subset
        // (WalletConnect) supply the original array via `groupContext`.
        // Internal sources where `txs` is already the full group leave
        // `groupContext` unset and we fall back to `txs`.
        //
        // Multisig co-sign is the exception: the co-signer's device only holds
        // the signable subset of the proposed group (a swap's backend
        // pre-signed pool/fee slots never reach them), so the full-group hash
        // can't match. The dedicated cosign validator skips the recompute —
        // contiguity is still enforced, and full-group integrity is verified on
        // the submitter and by algod at submission.
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

// =============================================================================
// Context factories
// =============================================================================

/**
 * Extracts the external dependencies from {@link SigningMachineInput} into
 * a {@link SigningMachineDeps} object stored in the machine context.
 * Keeps dependency wiring in one place so context factories stay focused on
 * domain logic.
 */
const extractDeps = (input: SigningMachineInput): SigningMachineDeps => ({
    signTransactions: input.signTransactions,
    signQuantumTransactions: input.signQuantumTransactions,
    signArbitraryData: input.signArbitraryData,
    signArc60: input.signArc60,
    createTransport: input.createTransport,
    network: input.network,
    encodeTransaction: input.encodeTransaction,
    hardwareWalletRegistry: input.hardwareWalletRegistry,
})

/**
 * Resolves the initial machine context from the input.
 * Throws if the signer account cannot be found or signing is not possible.
 *
 * Only the primary signerAddress is stored in context. Signing actors resolve
 * the full WalletAccount from allAccounts at signing time, enabling per-group
 * account lookup for multi-signer requests.
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
