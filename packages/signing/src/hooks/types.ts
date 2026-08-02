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

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { type Decimal } from 'decimal.js'
import type { SnapshotFrom } from 'xstate'

import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'

import type {
    SigningMachineContext,
    ResolvedSignerType,
} from '../machine/context'
import type { hardwareSigningMachine } from '../machine/children/hardwareSigningMachine'
import type {
    PipelineStage,
    SigningPipelineEvent,
    SignRequest,
    TransactionWarning,
} from '../models'
import type {
    RequestStructure,
    TransactionListItem,
} from '../utils/classification'
import type { FeeAdjustment } from '../pipeline/sources'
import type { parseArc60ForDisplay } from '../utils/parseArc60ForDisplay'

/**
 * Configuration passed to useSigningPipeline.
 * The onEvent callback is called once per state transition.
 */
export type SigningConfiguration = {
    onEvent?: (event: SigningPipelineEvent) => void
}

/**
 * The pipeline object returned by useSigningPipeline.
 * Combines display data, machine state, and controls in one place.
 */
export type SigningPipeline = {
    /** The current signing request, or undefined if the queue is empty. */
    currentRequest: Optional<SignRequest>

    /** Current machine stage. */
    stage: PipelineStage

    /** True while the machine is in 'signing' or 'transporting'. */
    isLoading: boolean

    /** True when the machine is in 'failed' with a retryable error. */
    isRetryable: boolean

    /** The error if stage === 'failed', otherwise null. */
    error: Nullable<Error>

    // Display data — equivalent to useSigningRequestAnalysis output.
    // Populated from request.txs for transaction requests; empty for others.
    allTransactions: PeraDisplayableTransaction[]
    listItems: TransactionListItem[]
    signableAddresses: Set<string>
    /**
     * Indices into `allTransactions` the wallet will actually sign. The UI
     * uses this to label slots the wallet skips (other-party-signed atomic
     * group members, `signers: []` entries). Empty set when no request.
     */
    signableIndices: Set<number>
    totalFee: Decimal
    warnings: TransactionWarning[]
    distinctWarnings: TransactionWarning[]
    requestStructure: RequestStructure

    /**
     * Fees the pipeline raised to a required minimum (each record carries
     * its reason — today only the post-quantum minimum for quantum signers),
     * in µAlgo, indexed into the full group (`groupContext ?? txs`) space.
     * Empty when nothing was adjusted; the sign-review UI renders the
     * original → adjusted delta from these entries.
     */
    feeAdjustments: FeeAdjustment[]

    /** Approve the current request (sends USER_APPROVED). No-op when idle. */
    next: () => void

    /** Reject the current request (sends USER_REJECTED). No-op when idle. */
    fail: () => void

    /** Retry after a retryable failure (sends RETRY). No-op when not retryable. */
    retry: () => void

    /** Resolved state derived from machine context. Null when the queue is empty. */
    resolved: Nullable<ResolvedSignRequest>

    /** Sends RETRY_HARDWARE to retry hardware connection after a BLE-class error. */
    retryHardware: () => void

    /** Sends ACKNOWLEDGE_HARDWARE_ERROR to release the hardware error state, marking failure. */
    acknowledgeHardwareError: () => void
}

export type MachineSnapshot = {
    value: unknown
    context: SigningMachineContext
    matches: (stateValue: string) => boolean
}

type Arc60ParsedForDisplay = ReturnType<typeof parseArc60ForDisplay>

export type SourceKind =
    | 'local'
    | 'walletconnect'
    | 'webview'
    | 'multisig-cosign'
    | 'deeplink'
    | 'gift-card'
    | 'arc60'
    | 'injected'

export type TransportKind =
    | 'algod'
    | 'callback'
    | 'multisig-propose'
    | 'multisig-cosign'

export type ResolvedRequestKind =
    | {
          type: 'transactions'
          isMultisigCosign: boolean
          cosignSignerAddress: Nullable<string>
          hasMultiple: boolean
      }
    | { type: 'arbitrary-data'; isSingle: boolean }
    | { type: 'arc60'; parsed: Arc60ParsedForDisplay }

export type HardwareChildSnapshot = SnapshotFrom<typeof hardwareSigningMachine>

export type { HardwareSigningOperation } from '../machine/children/hardwareSigningMachine.context'

/**
 * Snapshot of the currently-invoked signer child machine, exposed via
 * `ResolvedSignRequest.activeChild`. Null when no child is in flight.
 *
 * Today only the hardware variant is wired up; multisig will be added in a
 * follow-up task once `multisigSigningMachine` is invoked as a child.
 */
export type ActiveSigningChild = {
    kind: 'hardware'
    snapshot: HardwareChildSnapshot
} | null

export type ResolvedSignRequest = {
    signerType: ResolvedSignerType
    signerAccount: WalletAccount
    groupSignerTypes: ReadonlyMap<string, ResolvedSignerType>
    source: { kind: SourceKind; isInteractive: boolean }
    transport: { kind: TransportKind }
    kind: ResolvedRequestKind
    /** Snapshot of the active signer child machine, or null if no child is running. */
    activeChild: ActiveSigningChild
}
