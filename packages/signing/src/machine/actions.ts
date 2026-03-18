/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    isLedgerAccount,
    isMultisigAccount,
    resolveAuthAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    SignableGroup,
    SigningResult,
    SourceCallbacks,
    SourceMetadata,
} from '../pipeline/types'
import { CannotSignError } from '../pipeline/errors'
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
// Signer address extraction
// =============================================================================

/**
 * Extracts the signer address from a SignRequest.
 * For transactions: uses the first transaction's sender.
 * For arbitrary data: uses the first data item's signer.
 */
const extractSignerAddress = (request: SignRequest): string => {
    if (isTransactionRequest(request)) {
        const firstTx = request.txs[0]
        if (!firstTx) {
            throw new Error('No transactions in request')
        }
        return firstTx.sender.toString()
    }

    if (isArbitraryDataRequest(request)) {
        const firstData = request.data[0]
        if (!firstData) {
            throw new Error('No data in request')
        }
        return firstData.signer
    }

    if (isArc60Request(request)) {
        return request.signer
    }

    const _exhaustive: never = request
    throw new Error(
        `Cannot determine signer for request type: ${(_exhaustive as SignRequest).type}`,
    )
}

// =============================================================================
// Signer type resolution
// =============================================================================

/**
 * Determines the signing strategy type based on the signer and auth accounts.
 * - multisig: the original signer account is a multisig account
 * - ledger:   the auth account (after rekey resolution) is a Ledger hardware wallet
 * - localKey: the auth account has local signing keys (Algo25 / HDWallet)
 */
const determineSignerType = (
    signerAccount: WalletAccount,
    authAccount: WalletAccount,
): ResolvedSignerType => {
    if (isMultisigAccount(signerAccount)) {
        return 'multisig'
    }
    if (isLedgerAccount(authAccount)) {
        return 'ledger'
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
 */
const buildGroupSignerTypeMap = (
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
            throw new Error(`Signer account not found: ${group.signerAddress}`)
        }
        const authAccount = resolveAuthAccount(signerAccount, allAccounts)
        map.set(
            group.signerAddress,
            determineSignerType(signerAccount, authAccount),
        )
    }
    return map
}

// =============================================================================
// SignableGroup construction
// =============================================================================

/**
 * Constructs {@link SourceMetadata} from a {@link SignRequest}.
 * For local requests, returns a minimal metadata object.
 * For external sources (WalletConnect, webview, deeplink), wires the request's
 * approve/reject/error callbacks into the {@link SourceCallbacks} shape so
 * the transport layer can notify the originator of the signing outcome.
 */
const buildSourceMetadata = (request: SignRequest): SourceMetadata => {
    const sourceType = request.sourceType ?? 'local'

    if (sourceType === 'local') {
        return { type: 'local' }
    }

    // External sources (walletconnect, webview, deeplink) use callbacks
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
                await dataApprove(
                    result.signedData.signatures.map((signature, i) => ({
                        signature,
                        signer: result.signers[i]?.address ?? '',
                    })),
                )
            }
        }
    }

    return {
        type: sourceType,
        requestId: request.transportId ?? request.id,
        callbacks: {
            approve: approveCallback,
            reject: 'reject' in request ? request.reject : undefined,
            error: 'error' in request ? request.error : undefined,
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
 * For arbitrary-data requests, a single group is produced using the first
 * item's signer as the group's signerAddress.
 */
const buildSignableGroups = (request: SignRequest): SignableGroup[] => {
    const source = buildSourceMetadata(request)

    if (isTransactionRequest(request)) {
        // Group transactions by sender, preserving original position
        const bySender = new Map<
            string,
            { txs: typeof request.txs; indices: number[] }
        >()
        for (const [i, tx] of request.txs.entries()) {
            const addr = tx.sender.toString()
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

    throw new Error(`Unsupported request type: ${request.type}`)
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
    createTransport: input.createTransport,
    network: input.network,
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

    const signerAddress = extractSignerAddress(request)
    const signableGroups = buildSignableGroups(request)
    const groupSignerTypes = buildGroupSignerTypeMap(
        signableGroups,
        allAccounts,
    )

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
    deps: extractDeps(input),
})
