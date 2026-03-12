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
import type { PeraSignedTransaction } from '@perawallet/wallet-core-blockchain'
import type { Network } from '@perawallet/wallet-core-shared'
import type {
    SignableGroup,
    SignableAnalysis,
    SigningResult,
    TransportResult,
} from '../pipeline/types'
import type { AlgokitClientInterface } from '../pipeline/transports/createAlgodTransport'
import type { ProposeSignRequestFn } from '../pipeline/transports/createMultisigProposeTransport'
import type { AddSignaturesFn } from '../pipeline/transports/createMultisigCosignTransport'
import type { LocalSigningFunction } from '../pipeline/signing/createLocalKeyStrategy'
import type { SignRequest } from '../models'

// =============================================================================
// Resolved Signer Type
// =============================================================================

/**
 * The type of signing actor to invoke, resolved at machine creation time.
 * - localKey: HD wallet or Algo25 account (signing keys available on device)
 * - ledger: Hardware wallet requiring BLE connection and physical confirmation
 * - multisig: Multi-signature account requiring partial signature collection
 */
export type ResolvedSignerType = 'localKey' | 'ledger' | 'multisig'

// =============================================================================
// Machine Deps
// =============================================================================

/**
 * Runtime dependencies injected when creating a signingMachine actor.
 * These are functions and clients that cannot be known at machine definition time.
 */
export type SigningMachineDeps = {
    /** KMS signing function from useTransactionSigner */
    signTransactions: LocalSigningFunction
    /** Encodes signed transactions to raw bytes for algod submission */
    encodeSignedTransactions: (txns: PeraSignedTransaction[]) => Uint8Array[]
    /** AlgorandClient for direct algod submission */
    algokit: AlgokitClientInterface
    /** Backend API: propose new multisig sign request */
    proposeSignRequest: ProposeSignRequestFn
    /** Backend API: add signatures to existing multisig request */
    addSignatures: AddSignaturesFn
    /** Current network (mainnet / testnet) */
    network: Network
}

// =============================================================================
// Machine Context
// =============================================================================

/**
 * The full context of a signingMachine instance.
 * One machine instance is created per SignRequest.
 */
export type SigningMachineContext = {
    /**
     * The original sign request — kept for backward compat with UI
     * that reads `currentRequest` from useSigningRequest().
     */
    request: SignRequest

    /**
     * All user accounts, needed by the analyzer and for account resolution.
     */
    allAccounts: WalletAccount[]

    /**
     * The account that will sign (or the multisig account to sign for).
     * Resolved from the request's signer address against allAccounts.
     */
    signerAccount: WalletAccount | null

    /**
     * The account that will actually provide the cryptographic signature.
     * Differs from signerAccount when the account is rekeyed:
     * authAccount is the rekey target that holds the private key.
     */
    authAccount: WalletAccount | null

    /**
     * Signer type resolved in idle state.
     * Determines which signing actor is invoked in the `signing` state.
     */
    resolvedSignerType: ResolvedSignerType | null

    /**
     * The signable group built from the request, populated after idle resolution.
     * Contains the raw data to sign + source metadata.
     */
    signableGroup: SignableGroup | null

    /**
     * Analysis result from the `validating` state.
     * Contains fees, warnings, risk level, and signable addresses.
     */
    analysis: SignableAnalysis | null

    /**
     * Signing result from the `signing` state.
     * Contains signed data and signer info.
     */
    signingResult: SigningResult | null

    /**
     * Transport result from the `transporting` state.
     * Contains txIds, callback result, or multisig proposal info.
     */
    transportResult: TransportResult | null

    /** Error captured when the machine enters the `failed` state. */
    error: Error | null

    /**
     * Runtime dependencies (KMS functions, AlgoKit client, etc).
     * Stored in context so actor `input` functions can pass them to invoked actors.
     */
    deps: SigningMachineDeps
}

// =============================================================================
// Machine Events
// =============================================================================

/** User tapped the confirm/sign button in the signing UI */
export type UserApprovedEvent = { type: 'USER_APPROVED' }

/** User tapped the cancel/reject button in the signing UI */
export type UserRejectedEvent = { type: 'USER_REJECTED' }

/** All events the signing machine accepts */
export type SigningMachineEvent = UserApprovedEvent | UserRejectedEvent

// =============================================================================
// Machine Input
// =============================================================================

/**
 * Input provided when creating a signingMachine actor.
 * Combines the sign request, all accounts, and runtime deps.
 */
export type SigningMachineInput = {
    request: SignRequest
    allAccounts: WalletAccount[]
} & SigningMachineDeps
