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
 * The type of signing actor to invoke for a given signer address.
 * - localKey: HD wallet or Algo25 account (signing keys available on device)
 * - ledger: Hardware wallet requiring BLE connection and physical confirmation
 * - multisig: Multi-signature account requiring partial signature collection
 */
export type ResolvedSignerType = 'localKey' | 'ledger' | 'multisig'

/**
 * Maps each unique signer address in the request to its resolved signing type.
 * Used to dispatch signable groups to the correct actor sequentially.
 */
export type GroupSignerTypeMap = Map<string, ResolvedSignerType>

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
     * This is the source of truth — actors look up accounts here rather than
     * storing copies in context.
     */
    allAccounts: WalletAccount[]

    /**
     * The primary signer address for this request (from the first group's sender).
     * Used for transport routing (e.g. detecting multisig propose vs algod).
     * Actors resolve the full WalletAccount from allAccounts when needed.
     */
    signerAddress: string | null

    /**
     * Maps each unique signer address to its resolved signing type.
     * Populated in idle state. Used by the `signing` state to dispatch
     * each group to the correct actor sequentially.
     */
    groupSignerTypes: GroupSignerTypeMap | null

    /**
     * Tracks which signer types have already completed during sequential dispatch.
     * Each completed type is appended after its actor finishes. When the set of
     * completed types equals the unique types in groupSignerTypes, all groups
     * are signed and the machine can advance to transporting.
     */
    completedSignerTypes: ResolvedSignerType[]

    /**
     * The signable groups built from the request, populated after idle resolution.
     * Each group contains the raw data to sign + source metadata.
     * Multiple groups can exist when a single request spans several atomic transaction groups
     * (e.g. a Multisig request with transactions from multiple groups).
     */
    signableGroups: SignableGroup[] | null

    /**
     * Analysis results from the `validating` state, one per signable group.
     * Each entry contains fees, warnings, risk level, and signable addresses
     * for the corresponding group in `signableGroups`.
     */
    analyses: SignableAnalysis[] | null

    /**
     * Signing results from the `signing` state, one per signable group.
     * Each entry contains signed data and signer info for the corresponding group.
     */
    signingResults: SigningResult[] | null

    /**
     * Transport result from the `transporting` state.
     * Contains txIds, callback result, or multisig proposal info.
     */
    transportResult: TransportResult | null

    /** Error captured when the machine enters the `failed` state. */
    error: Error | null

    /**
     * Which state the machine was in when the error occurred.
     * Used to determine the retry target when the user taps "Retry".
     */
    failedDuringState: 'validating' | 'signing' | 'transporting' | null

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

/** User tapped retry after a retryable failure */
export type RetryEvent = { type: 'RETRY' }

/** All events the signing machine accepts */
export type SigningMachineEvent =
    | UserApprovedEvent
    | UserRejectedEvent
    | RetryEvent

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
