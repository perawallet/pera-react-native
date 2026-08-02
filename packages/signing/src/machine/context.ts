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
import type { QuantumSigningFunction } from '../pipeline/signing/createQuantumStrategy'
import type { EncodeTransactionFunction } from '../pipeline/signing/createHardwareStrategy'
import type { SignRequest } from '../models'

/**
 * Which signing actor to invoke. `quantum` (Falcon-1024) produces a pqsig byte
 * carrier rather than a plain Ed25519 signature.
 */
export type ResolvedSignerType =
    | 'localKey'
    | 'hardware'
    | 'multisig'
    | 'quantum'

export type GroupSignerTypeMap = Map<string, ResolvedSignerType>

/**
 * Built by {@link createTransportSelector} in the React hook layer, where the
 * runtime clients exist, then threaded through context so the transport actor
 * can call it without knowing implementations.
 */
export type TransportFactory = (
    source: SourceMetadata,
    account: WalletAccount,
) => DataTransport

/** Functions and clients that can't be known at machine definition time. */
export type SigningMachineDeps = {
    signTransactions: LocalSigningFunction
    signQuantumTransactions: QuantumSigningFunction
    signArbitraryData: LocalArbitrarySigningFunction
    signArc60: LocalArc60SigningFunction
    createTransport: TransportFactory
    network: Network
    hardwareWalletRegistry?: HardwareWalletRegistry
    /** For hardware wallet signing. */
    encodeTransaction: EncodeTransactionFunction
}

/** One machine instance per SignRequest. */
export type SigningMachineContext = {
    /** Kept for UI that still reads `currentRequest` from useSigningRequest(). */
    request: SignRequest

    /**
     * Source of truth — actors look accounts up here rather than storing
     * copies in their own context.
     */
    allAccounts: WalletAccount[]

    /** From the first group's sender; drives transport routing. */
    signerAddress: Nullable<string>

    /** Populated in idle; `signing` dispatches on it sequentially. */
    groupSignerTypes: Nullable<GroupSignerTypeMap>

    /**
     * Appended to as each actor finishes. Once this covers every unique type
     * in `groupSignerTypes`, the machine advances to transporting.
     */
    completedSignerTypes: ResolvedSignerType[]

    /**
     * Multiple groups exist when one request spans several atomic transaction
     * groups (e.g. a multisig request drawing from more than one).
     */
    signableGroups: Nullable<SignableGroup[]>

    /** One per entry in `signableGroups`. */
    analyses: Nullable<SignableAnalysis[]>

    /** One per entry in `signableGroups`. */
    signingResults: Nullable<SigningResult[]>

    transportResult: Nullable<TransportResult>

    /** Error captured when the machine enters the `failed` state. */
    error: Nullable<Error>

    /** The retry target when the user taps "Retry". */
    failedDuringState: Nullable<'validating' | 'signing' | 'transporting'>

    /**
     * Bumped on every invoked-signer-child snapshot (see the `onSnapshot`
     * handler on the `signing.hardware` invoke). XState v5 parents do NOT
     * re-emit when only a child's sub-state changes, so without this nudge the
     * signing overlay froze on "connecting" while the Ledger advanced through
     * its phases. Carries no data — it only forces a re-broadcast; the UI
     * reads live signer state from `resolved.activeChild`.
     */
    signerSnapshotTick: number

    /** In context so actor `input` functions can forward them to children. */
    deps: SigningMachineDeps
}

export type UserApprovedEvent = { type: 'USER_APPROVED' }

export type UserRejectedEvent = { type: 'USER_REJECTED' }

export type RetryEvent = { type: 'RETRY' }

/** Re-attempt the current group after a recoverable hardware error. */
export type RetryHardwareEvent = { type: 'RETRY_HARDWARE' }

/** Abandon the in-flight request after a hardware error. */
export type AcknowledgeHardwareErrorEvent = {
    type: 'ACKNOWLEDGE_HARDWARE_ERROR'
}

export type SigningMachineEvent =
    | UserApprovedEvent
    | UserRejectedEvent
    | RetryEvent
    | RetryHardwareEvent
    | AcknowledgeHardwareErrorEvent

export type SigningMachineInput = {
    request: SignRequest
    allAccounts: WalletAccount[]
} & SigningMachineDeps
