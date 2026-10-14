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
    transactionPlanners,
    type ChainId,
    type ChainScope,
    type TransactionPlanner,
    type UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    isKeyedByPlanner,
    isUnsignedTransactionsData,
    type SignableGroup,
    type SigningResult,
    type SourceCallbacks,
    type SubmissionReceipt,
    type SourceMetadata,
} from '../pipeline/types'
import {
    CannotSignError,
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
import type { SignRequest, UnsignedTransactionSignRequest } from '../models'
import {
    isTransactionRequest,
    isArbitraryDataRequest,
    isAuthDataRequest,
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
        approveCallback = async (
            result: SigningResult,
            submission?: SubmissionReceipt,
        ) => {
            if (result.signedData.type === 'transactions') {
                await txApprove(result.signedData.signed, submission)
            }
        }
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
        // WalletConnect-only: a serializable delivery context so the multisig
        // sync-flow handoff can answer the dApp after an app kill. Gated on
        // `payloadId`, which only the WalletConnect handler sets.
        handoffDelivery:
            isTransactionRequest(request) && request.payloadId !== undefined
                ? {
                      clientId: request.transportId ?? '',
                      payloadId: request.payloadId,
                      indicesToSign: request.signableIndices ?? [],
                      totalLength: request.totalLength ?? 0,
                  }
                : undefined,
    }
}

const MIXED_SHAPES = 'the request mixes Algorand and chain-neutral transactions'

const isChainNeutralTransactions = (group: SignableGroup): boolean =>
    group.data.type === 'transactions' && isUnsignedTransactionsData(group.data)

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
    const rawBytes = request.chainData?.algorand?.rawTransactionsBase64

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
            chainData: signedForKeys
                ? {
                      algorand: {
                          indicesToSign: txs.map((_, i) => i),
                          ...(rawBytes && {
                              rawTransactionsBase64: indices.map(
                                  i => rawBytes[i],
                              ),
                          }),
                      },
                  }
                : {},
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
): string | undefined => {
    const held = [...new Set(signers)].flatMap(
        signer =>
            findAccountByAddressOn(allAccounts, scope.chainId, signer) ?? [],
    )
    const account =
        held.find(candidate => candidate.custody.kind === 'local') ?? held[0]
    // The wallet's spelling, so the group key and every later lookup agree.
    return account && chainAccountOf(account, scope.chainId)?.address
}

// Undefined for a chain that keys by planned signer; see `signedForAddresses` on the planner adapter.
const signedForAddresses = (
    request: UnsignedTransactionSignRequest,
    allAccounts: WalletAccount[],
    scope: ChainScope,
): (string | undefined)[] | undefined => {
    if (!plannerChainAdapters.has(scope.chainId)) return undefined
    const adapter = plannerChainAdapters.get(scope.chainId)
    const addresses = adapter.signedForAddresses(request)
    if (!addresses) return undefined
    adapter.validateGroup(
        request.chainData?.algorand?.groupContext ?? request.txs,
        { isCosigner: request.sourceType === 'multisig-cosign' },
    )
    const knownAddresses = new Set(
        allAccounts.flatMap(
            a => chainAccountOf(a, scope.chainId)?.address ?? [],
        ),
    )
    return addresses.map(address =>
        knownAddresses.has(address) ? address : undefined,
    )
}

// A payload the chain can't read is untrusted data, not an internal fault.
const planSigners = (
    planner: TransactionPlanner,
    transaction: UnsignedTransaction,
): string[] => {
    try {
        return planner.plan(transaction).map(entry => entry.signer)
    } catch (error) {
        throw new InvalidSignableDataError(
            error instanceof Error ? error.message : String(error),
        )
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
    const source = buildSourceMetadata(request)

    if (
        isTransactionRequest(request) &&
        isUnsignedTransactionRequest(request)
    ) {
        return buildUnsignedTransactionGroups(
            request,
            allAccounts,
            scope,
            source,
        )
    }

    if (isTransactionRequest(request)) {
        if (request.txs.some(isUnsignedTransaction)) {
            throw new InvalidSignableDataError(MIXED_SHAPES)
        }
        // Group integrity is checked over the full payload: sources that filter
        // `txs` supply the original via `groupContext`, others fall back to
        // `txs`.
        //
        // Multisig co-sign is the exception — the co-signer only holds the
        // signable subset, so the full-group hash can't match. Its validator
        // skips the recompute; contiguity is still enforced, and full-group
        // integrity is verified on the submitter and by algod.
        const txsToValidate = request.groupContext ?? request.txs
        const planner = plannerAdapterForScope(scope)
        planner.validateGroup(txsToValidate, {
            isCosigner: request.sourceType === 'multisig-cosign',
        })

        const knownAddresses = new Set(
            allAccounts.flatMap(
                a => chainAccountOf(a, scope.chainId)?.address ?? [],
            ),
        )
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
    encodeTransaction: input.encodeTransaction,
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

    const signableGroups = buildSignableGroups(
        request,
        allAccounts,
        input.scope,
    )

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
    // common signed shape to deliver in, so refuse before anything is signed.
    const chainNeutral = signableGroups.filter(isChainNeutralTransactions)
    const planned = chainNeutral.filter(group =>
        isPlannerSigned(
            group,
            groupSigners.get(group.signerAddress),
            input.scope.chainId,
        ),
    )
    if (planned.length > 0 && planned.length < chainNeutral.length) {
        throw new SigningError(
            'This request needs signers that sign in different ways, so it cannot be delivered as one group',
            undefined,
            { retryable: false },
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
