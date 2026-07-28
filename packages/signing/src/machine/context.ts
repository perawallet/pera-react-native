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
import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import type {
    DataTransport,
    SignableGroup,
    SignableAnalysis,
    SigningResult,
    SourceMetadata,
    TransportResult,
} from '../pipeline/types'
import type { HardwareWalletRegistry } from '@perawallet/wallet-core-hardware-wallet'
import type {
    LocalSigningFunction,
    LocalArbitrarySigningFunction,
    LocalArc60SigningFunction,
} from '../pipeline/signing/createLocalKeyStrategy'
import type { EncodeTransactionFunction } from '../pipeline/signing/createHardwareStrategy'
import type { SignRequest } from '../models'

// =============================================================================
// Resolved Signer Type
// =============================================================================

/**
 * The type of signing actor to invoke for a given signer address.
 * - localKey: HD wallet, Algo25, or quantum (post-quantum, Falcon-1024)
 *   account (signing keys available on device) — the scheme (plain
 *   signature vs. pqsig) is resolved inside the injected signing function
 * - hardware: Hardware wallet requiring device connection and physical confirmation
 * - multisig: Multi-signature account requiring partial signature collection
 */
export type ResolvedSignerType = 'localKey' | 'hardware' | 'multisig'

/**
 * Maps each unique signer address in the request to its resolved signing type.
 * Used to dispatch signable groups to the correct actor sequentially.
 */
export type GroupSignerTypeMap = Map<string, ResolvedSignerType>

// =============================================================================
// Machine Deps
// =============================================================================

/**
 * Selects and returns the appropriate {@link DataTransport} for a given
 * source type and signer account (e.g. algod, WalletConnect, multisig).
 *
 * Created via {@link createTransportSelector} in the React hook layer
 * where all runtime clients are available, then threaded through context
 * so the transport actor can call it without knowing implementation details.
 */
export type TransportFactory = (
    source: SourceMetadata,
    account: WalletAccount,
) => DataTransport

/**
 * Runtime dependencies injected when creating a signingMachine actor.
 * These are functions and clients that cannot be known at machine definition time.
 */
export type SigningMachineDeps = {
    /** KMS signing function from useLocalKeyTransactionSigner */
    signTransactions: LocalSigningFunction
    /** KMS arbitrary-data signing function from useArbitraryDataSigner */
    signArbitraryData: LocalArbitrarySigningFunction
    /** KMS ARC-60 signing function from useLocalKeyArc60Signer */
    signArc60: LocalArc60SigningFunction
    /** Selects the correct transport (algod, callback, multisig, etc.) */
    createTransport: TransportFactory
    /** Current network (mainnet / testnet) */
    network: Network
    /** Hardware wallet registry from platform extension (optional) */
    hardwareWalletRegistry?: HardwareWalletRegistry
    /** Transaction encoder for hardware wallet signing */
    encodeTransaction: EncodeTransactionFunction
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
    signerAddress: Nullable<string>

    /**
     * Maps each unique signer address to its resolved signing type.
     * Populated in idle state. Used by the `signing` state to dispatch
     * each group to the correct actor sequentially.
     */
    groupSignerTypes: Nullable<GroupSignerTypeMap>

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
    signableGroups: Nullable<SignableGroup[]>

    /**
     * Analysis results from the `validating` state, one per signable group.
     * Each entry contains fees, warnings, risk level, and signable addresses
     * for the corresponding group in `signableGroups`.
     */
    analyses: Nullable<SignableAnalysis[]>

    /**
     * Signing results from the `signing` state, one per signable group.
     * Each entry contains signed data and signer info for the corresponding group.
     */
    signingResults: Nullable<SigningResult[]>

    /**
     * Transport result from the `transporting` state.
     * Contains txIds, callback result, or multisig proposal info.
     */
    transportResult: Nullable<TransportResult>

    /** Error captured when the machine enters the `failed` state. */
    error: Nullable<Error>

    /**
     * Which state the machine was in when the error occurred.
     * Used to determine the retry target when the user taps "Retry".
     */
    failedDuringState: Nullable<'validating' | 'signing' | 'transporting'>

    /**
     * Monotonic counter bumped whenever an invoked signer child (currently the
     * hardware-signing child) emits a new snapshot — see the `onSnapshot`
     * handler on the `signing.hardware` invoke.
     *
     * XState v5 parents do NOT re-emit when only an invoked child's sub-state
     * changes, so without this nudge the signing UI — which subscribes to the
     * parent snapshot — never re-rendered while the Ledger device advanced
     * through its phases (the overlay froze on the "connecting" screen). This
     * is deliberately domain-agnostic: it carries no signer-specific data, it
     * only forces the parent to re-broadcast. The UI reads the live signer
     * state from the child snapshot (`resolved.activeChild`).
     */
    signerSnapshotTick: number

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

/** UI requests the hardware child re-attempts the current group after a recoverable error */
export type RetryHardwareEvent = { type: 'RETRY_HARDWARE' }

/** UI acknowledges the hardware child error, abandoning the in-flight request */
export type AcknowledgeHardwareErrorEvent = {
    type: 'ACKNOWLEDGE_HARDWARE_ERROR'
}

/** All events the signing machine accepts */
export type SigningMachineEvent =
    | UserApprovedEvent
    | UserRejectedEvent
    | RetryEvent
    | RetryHardwareEvent
    | AcknowledgeHardwareErrorEvent

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
