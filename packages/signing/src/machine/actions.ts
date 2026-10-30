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
    findAccountByAddressOn,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    ScopeChangedError,
    toScopeKey,
    transactionPlanners,
    type ChainId,
    type ChainScope,
    type TransactionPlanner,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import { toError, type Optional } from '@perawallet/wallet-core-shared'
import { recordReviewApproval } from '../db/repository'
import {
    isInteractiveSource,
    isKeyedByPlanner,
    type SignableGroup,
    type SigningResult,
    type SourceCallbacks,
    type SourceMetadata,
} from '../pipeline/types'
import {
    CannotSignError,
    GenesisHashMismatchError,
    HardwareWalletError,
    InvalidSignableDataError,
    SigningError,
} from '../pipeline/errors'
import { plannerAdapterForScope, plannerChainAdapters } from '../chain-adapter'
import { isPlannerSigned } from './utils/isPlannerSigned'
import { resolveSigningAccount } from './utils/resolveSigningAccount'
import { resolveSignerCredential } from './utils/resolveSignerCredential'
import type {
    GroupSignerMap,
    SigningMachineContext,
    SigningMachineDeps,
    SigningMachineInput,
} from './context'
import type {
    ReviewApproval,
    SignRequest,
    TransactionSignRequest,
    UnsignedTransactionSignRequest,
} from '../models'
import {
    isTransactionRequest,
    isArbitraryDataRequest,
    isAuthDataRequest,
    isMessageRequest,
    isUnsignedTransaction,
    isUnsignedTransactionRequest,
} from '../models'

/**
 * Resolves each group's signer from the AUTH account, whatever authorizes the
 * signature once {@link resolveSigningAccount} has applied the rekey/cosign
 * rules, not the sender. That also covers the externally-rekeyed multisig (one
 * whose on-chain auth is a standard/Ledger account we hold): the auth key
 * signs, rather than failing with NoLocalParticipantsError.
 */
export const buildGroupSignerMap = (
    groups: SignableGroup[],
    allAccounts: WalletAccount[],
    chainId: ChainId,
): GroupSignerMap => {
    const map: GroupSignerMap = new Map()
    for (const group of groups) {
        if (map.has(group.signerAddress)) continue
        const signerAccount = findAccountByAddressOn(
            allAccounts,
            chainId,
            group.signerAddress,
        )
        if (!signerAccount) {
            throw new CannotSignError(
                group.signerAddress,
                'signer account not found in wallet',
            )
        }
        const authAccount = isKeyedByPlanner(group.data)
            ? signerAccount
            : resolveSigningAccount(
                  signerAccount,
                  group.source,
                  group.data.type,
                  allAccounts,
                  chainId,
              )
        map.set(
            group.signerAddress,
            resolveSignerCredential(authAccount, chainId),
        )
    }
    return map
}

// A transaction request's `approve` gets its chain's wire-encoded signed
// transactions, whichever signer produced them.
// Reaching delivery means the user approved this review, so what it listed is
// recorded here, never by the caller, for the transactions signed after it. A
// batch of one still lists `followingTxs`, empty: its first call may be rebuilt
// and signed again after a restart.
const approvalOf = async (
    request: TransactionSignRequest,
    scope: ChainScope,
): Promise<Optional<ReviewApproval>> => {
    if (
        !isUnsignedTransactionRequest(request) ||
        request.followingTxs === undefined ||
        !isInteractiveSource(request.sourceType)
    ) {
        return undefined
    }
    const token = await recordReviewApproval({
        scope,
        transactions: [...request.txs, ...request.followingTxs],
    })
    return { token }
}

const transactionApproveOf = (
    request: TransactionSignRequest,
    scope: ChainScope,
): SourceCallbacks['approve'] => {
    const approve = request.approve
    return (
        approve &&
        (async (result, submission) => {
            // Already in the chain's wire form, and a chain with no
            // planner adapter has no `signedTransactionsOf` to ask.
            const signed =
                result.signedData.type === 'signed-transactions'
                    ? result.signedData.signed
                    : plannerAdapterForScope(scope).signedTransactionsOf(
                          result,
                          scope,
                      )
            const approval = await approvalOf(request, scope)
            await (approval
                ? approve(signed, submission, approval)
                : approve(signed, submission))
        })
    )
}

// A serializable delivery context so the multisig sync-flow handoff can
// answer the dApp after an app kill.
const handoffDeliveryOf = (
    request: TransactionSignRequest,
    scope: ChainScope,
): SourceMetadata['handoffDelivery'] => {
    if (
        !isUnsignedTransactionRequest(request) ||
        !plannerChainAdapters.has(scope.chainId)
    ) {
        return undefined
    }
    const delivery = plannerChainAdapters
        .get(scope.chainId)
        .handoffDeliveryOf(request)
    return delivery && { clientId: request.transportId ?? '', ...delivery }
}

/**
 * Dispatches on the tagged fields (`sourceType`, `transport`), NOT on whether an
 * `approve` callback happens to be present, so the selector stays predictable
 * as new caller shapes appear.
 */
const buildSourceMetadata = (
    request: SignRequest,
    scope: ChainScope,
): SourceMetadata => {
    const sourceType = request.sourceType ?? 'local'
    const isLocalNetwork =
        sourceType === 'local' && request.transport === 'network'

    if (isLocalNetwork) {
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

    if (isTransactionRequest(request)) {
        approveCallback = transactionApproveOf(request, scope)
    } else if (
        (isArbitraryDataRequest(request) || isAuthDataRequest(request)) &&
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
            } else if (result.signedData.type === 'auth-data') {
                // Auth-data signing produces a single signature; project the result
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
    } else if (isMessageRequest(request) && request.approve) {
        const messageApprove = request.approve
        approveCallback = async (result: SigningResult) => {
            if (result.signedData.type === 'message') {
                await messageApprove(result.signedData.signed)
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
        handoffDelivery: isTransactionRequest(request)
            ? handoffDeliveryOf(request, scope)
            : undefined,
    }
}

const MIXED_SHAPES = 'the request mixes legacy and chain-neutral transactions'
const LEGACY_SHAPE = 'transactions must be sent as chain-neutral transactions'

const isTransactionsGroup = (group: SignableGroup): boolean =>
    group.data.type === 'transactions'

/**
 * Groups chain-neutral transactions by signer. As on the Algorand path, a
 * transaction no wallet account signs is left out.
 */
const buildUnsignedTransactionGroups = (
    request: UnsignedTransactionSignRequest,
    allAccounts: WalletAccount[],
    scope: ChainScope,
    source: SourceMetadata,
): SignableGroup[] => {
    const planner = transactionPlanners.get(scope.chainId)
    const plannedSigners = request.txs.map(tx => {
        if (!isUnsignedTransaction(tx)) {
            throw new InvalidSignableDataError(MIXED_SHAPES)
        }
        // Planned first: a planner refuses another chain's transaction.
        const signers = planSigners(planner, tx)
        // Built for another network than the chain's selected one, by a dApp
        // or before the user switched.
        if (tx.scope.networkId !== scope.networkId) {
            throw new ScopeChangedError(tx.scope, scope)
        }
        return signers
    })

    const signedForKeys = signedForAddresses(request, allAccounts, scope)

    const bySigner = new Map<
        string,
        { txs: UnsignedTransaction[]; indices: number[] }
    >()
    for (const [i, tx] of request.txs.entries()) {
        const signerAddress = signedForKeys
            ? signedForKeys[i]
            : heldPlannedSigner(plannedSigners[i], allAccounts, scope)
        if (!signerAddress) continue

        const entry = bySigner.get(signerAddress) ?? { txs: [], indices: [] }
        entry.txs.push(tx)
        entry.indices.push(i)
        bySigner.set(signerAddress, entry)
    }

    return [...bySigner.entries()].map(([signerAddress, { txs, indices }]) => ({
        data: {
            type: 'transactions',
            transactions: txs,
            ...(signedForKeys && {
                chainData: plannerAdapterForScope(scope).signableGroupChainData(
                    request,
                    indices,
                ),
            }),
        },
        source,
        signerAddress,
        originalIndices: indices,
    }))
}

// Keyed to the first key the wallet can sign with here, else the first it
// holds; the review lists every held signer.
const heldPlannedSigner = (
    signers: string[],
    allAccounts: WalletAccount[],
    scope: ChainScope,
): Optional<string> => {
    const held = [...new Set(signers)].flatMap(
        signer =>
            findAccountByAddressOn(allAccounts, scope.chainId, signer) ?? [],
    )
    const account =
        held.find(candidate => candidate.custody.kind === 'local') ?? held[0]
    // The wallet's spelling, so the group key and every later lookup agree.
    return account && chainAccountOf(account, scope.chainId)?.address
}

/**
 * The chain's group check. Run at ingest and again right before signing:
 * review-time steps (simulation, fee planning) run in between, and a group
 * that changed since the review must not reach a signer.
 */
export const validateRequestGroup = (
    request: UnsignedTransactionSignRequest,
    scope: ChainScope,
): void => {
    const adapter = plannerChainAdapters.get(scope.chainId)
    adapter.validateGroup(adapter.reviewGroupOf(request).transactions, {
        isCosigner: request.sourceType === 'multisig-cosign',
    })
}

// Undefined for a chain that keys by planned signer; see `signedForAddresses` on the planner adapter.
const signedForAddresses = (
    request: UnsignedTransactionSignRequest,
    allAccounts: WalletAccount[],
    scope: ChainScope,
): Optional<Optional<string>[]> => {
    if (!plannerChainAdapters.has(scope.chainId)) return undefined
    const addresses = plannerChainAdapters
        .get(scope.chainId)
        .signedForAddresses(request)
    if (!addresses) return undefined
    validateRequestGroup(request, scope)
    const knownAddresses = new Set(
        allAccounts.flatMap(
            a => chainAccountOf(a, scope.chainId)?.address ?? [],
        ),
    )
    return addresses.map(address =>
        knownAddresses.has(address) ? address : undefined,
    )
}

// A payload the chain can't read is untrusted data, not an internal fault; a
// wrong network keeps its own user-facing error.
const planSigners = (
    planner: TransactionPlanner,
    transaction: UnsignedTransaction,
): string[] => {
    try {
        return planner.plan(transaction).map(entry => entry.signer)
    } catch (error) {
        if (error instanceof GenesisHashMismatchError) throw error
        throw new InvalidSignableDataError(toError(error).message)
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
    scope: SigningMachineInput['scope'],
): SignableGroup[] => {
    const source = buildSourceMetadata(request, scope)

    if (isTransactionRequest(request)) {
        // A request persisted before every source built chain-neutral
        // transactions can still rehydrate in the old shape.
        const txs: readonly unknown[] = request.txs
        if (!isUnsignedTransactionRequest(request)) {
            // An empty request is left to the caller's "nothing to sign" refusal.
            if (txs.length === 0) return []
            throw new InvalidSignableDataError(
                txs.some(isUnsignedTransaction) ? MIXED_SHAPES : LEGACY_SHAPE,
            )
        }
        return buildUnsignedTransactionGroups(
            request,
            allAccounts,
            scope,
            source,
        )
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

    if (isAuthDataRequest(request)) {
        return [
            {
                data: {
                    type: 'auth-data',
                    authData: request.authData,
                    metadata: request.metadata,
                },
                source,
                signerAddress: request.authData.signer,
            },
        ]
    }

    if (isMessageRequest(request)) {
        const { message } = request
        // Stamped when the request was queued; the user may have switched
        // network while it waited behind another.
        if (toScopeKey(message.scope) !== toScopeKey(scope)) {
            throw new ScopeChangedError(message.scope, scope)
        }
        return [
            {
                data: { type: 'message', request: message },
                source,
                signerAddress: message.signer,
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
    signAuthData: input.signAuthData,
    createTransport: input.createTransport,
    scope: input.scope,
    hardwareWalletRegistry: input.hardwareWalletRegistry,
    keyStore: input.keyStore,
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

    let signableGroups = buildSignableGroups(request, allAccounts, input.scope)

    if (signableGroups.length === 0) {
        throw new CannotSignError(
            'unknown',
            'No signable transactions found in request',
        )
    }

    const signerAddress = signableGroups[0].signerAddress
    const groupSigners = buildGroupSignerMap(
        signableGroups,
        allAccounts,
        input.scope.chainId,
    )

    // A planner-signed group and one the chain's own signer signs have no
    // common signed shape to deliver in. A chain that groups by the account
    // signed for (Algorand) hands every group to its own signer instead; any
    // other chain refuses up front.
    const transactionGroups = signableGroups.filter(isTransactionsGroup)
    const planned = transactionGroups.filter(group =>
        isPlannerSigned(
            group,
            groupSigners.get(group.signerAddress),
            input.scope.chainId,
        ),
    )
    if (planned.length > 0 && planned.length < transactionGroups.length) {
        if (transactionGroups.some(group => isKeyedByPlanner(group.data))) {
            throw new SigningError(
                'This request needs signers that sign in different ways, so it cannot be delivered as one group',
                undefined,
                { retryable: false },
            )
        }
        signableGroups = signableGroups.map(group =>
            isTransactionsGroup(group)
                ? { ...group, shouldUseChainSigner: true }
                : group,
        )
    }

    const hasHardwareSigners = [...groupSigners.values()].some(
        signer => signer.custody === 'hardware',
    )
    if (hasHardwareSigners && !input.hardwareWalletRegistry) {
        throw new HardwareWalletError('registry_required')
    }

    return {
        request,
        allAccounts,
        signerAddress,
        groupSigners,
        completedCustodies: [],
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
    groupSigners: null,
    completedCustodies: [],
    signableGroups: null,
    analyses: null,
    signingResults: null,
    transportResult: null,
    error,
    failedDuringState: null,
    signerSnapshotTick: 0,
    deps: extractDeps(input),
})
