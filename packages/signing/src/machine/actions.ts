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
} from '@perawallet/wallet-core-accounts'
import type { SignableGroup, SourceMetadata } from '../pipeline/types'
import { resolveRekeyChain } from '../pipeline/signing/getSigningStrategy'
import { CannotSignError } from '../pipeline/errors'
import type {
    ResolvedSignerType,
    SigningMachineContext,
    SigningMachineDeps,
    SigningMachineInput,
} from './context'
import type {
    SignRequest,
    TransactionSignRequest,
    ArbitraryDataSignRequest,
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
    if (request.type === 'transactions' && 'txs' in request) {
        const txRequest = request as TransactionSignRequest
        const firstTx = txRequest.txs[0]
        if (!firstTx) {
            throw new Error('No transactions in request')
        }
        return firstTx.sender.toString()
    }

    if (request.type === 'arbitrary-data' && 'data' in request) {
        const dataRequest = request as ArbitraryDataSignRequest
        const firstData = dataRequest.data[0]
        if (!firstData) {
            throw new Error('No data in request')
        }
        return firstData.signer
    }

    throw new Error(`Cannot determine signer for request type: ${request.type}`)
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
// SignableGroup construction
// =============================================================================

const buildSourceMetadata = (request: SignRequest): SourceMetadata => {
    if (request.transport === 'algod') {
        return { type: 'local' }
    }

    // callback transport → WalletConnect
    // Note: callback shape mismatch (SigningResult vs PeraSignedTransaction[]) is
    // reconciled in Phase 6 when useSigningRequest is rewired.
    return {
        type: 'walletconnect',
        requestId: request.transportId ?? request.id,
        callbacks: {
            reject: 'reject' in request ? request.reject : undefined,
            error: 'error' in request ? request.error : undefined,
        },
    }
}

const buildSignableGroup = (request: SignRequest): SignableGroup => {
    const source = buildSourceMetadata(request)

    if (request.type === 'transactions' && 'txs' in request) {
        const txRequest = request as TransactionSignRequest
        return {
            data: {
                type: 'transactions',
                transactions: txRequest.txs,
                rawTransactionsBase64: [], // populated in Phase 6
                indicesToSign: txRequest.txs.map((_, i) => i),
            },
            source,
        }
    }

    if (request.type === 'arbitrary-data' && 'data' in request) {
        const dataRequest = request as ArbitraryDataSignRequest
        return {
            data: {
                type: 'arbitrary-data',
                data: dataRequest.data.map(d => new TextEncoder().encode(d.data)),
                messages: dataRequest.data.map(d => d.message ?? d.data),
            },
            source,
        }
    }

    throw new Error(`Unsupported request type: ${request.type}`)
}

// =============================================================================
// Context factories
// =============================================================================

const extractDeps = (input: SigningMachineInput): SigningMachineDeps => ({
    signTransactions: input.signTransactions,
    encodeSignedTransactions: input.encodeSignedTransactions,
    algokit: input.algokit,
    proposeSignRequest: input.proposeSignRequest,
    addSignatures: input.addSignatures,
    network: input.network,
})

/**
 * Resolves the initial machine context from the input.
 * Throws if the signer account cannot be found or signing is not possible.
 */
export const resolveInitialContext = (input: SigningMachineInput): SigningMachineContext => {
    const { request, allAccounts } = input

    const signerAddress = extractSignerAddress(request)
    const signerAccount = allAccounts.find(a => a.address === signerAddress) ?? null

    if (!signerAccount) {
        throw new Error(`Signer account not found: ${signerAddress}`)
    }

    const authAccount = resolveRekeyChain(signerAccount, allAccounts)
    const resolvedSignerType = determineSignerType(signerAccount, authAccount)
    const signableGroup = buildSignableGroup(request)

    return {
        request,
        allAccounts,
        signerAccount,
        authAccount,
        resolvedSignerType,
        signableGroup,
        analysis: null,
        signingResult: null,
        transportResult: null,
        error: null,
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
    signerAccount: null,
    authAccount: null,
    resolvedSignerType: null,
    signableGroup: null,
    analysis: null,
    signingResult: null,
    transportResult: null,
    error,
    deps: extractDeps(input),
})
