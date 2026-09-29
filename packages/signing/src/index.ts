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

export const name = '@perawallet/wallet-core-signing'

export {
    MAX_DATA_SIGN_REQUESTS,
    MAX_TRANSACTION_SIGN_REQUESTS,
} from './constants'

export {
    isTransactionRequest,
    type ArbitraryDataSignRequest,
    type Arc60SignRequest,
    type PeraArbitraryDataMessage,
    type PeraArbitraryDataSignResult,
    type SignRequest,
    type SignRequestSource,
    type SigningPipelineEvent,
    type TransactionSignRequest,
    type TransactionWarning,
} from './models'

export { SigningRequestScopeProvider } from './hooks/SigningRequestScope'
export type {
    HardwareChildSnapshot,
    HardwareSigningOperation,
} from './hooks/types'
export {
    useArc0001Resolver,
    type UseArc0001ResolverResult,
} from './hooks/useArc0001Resolver'
export {
    useEnqueueArc0001SignRequest,
    type EnqueueArc0001SignRequest,
    type ExternalSignTxnTransport,
} from './hooks/useEnqueueArc0001SignRequest'
export { useHandoffResolver } from './hooks/useHandoffResolver'
export { useImpactTransactions } from './hooks/useImpactTransactions'
export { useLastSigningEvent } from './hooks/useLastSigningEvent'
export { useLocalKeyTransactionSigner } from './hooks/useLocalKeyTransactionSigner'
export { useMinFeeForSender } from './hooks/useMinFeeForSender'
export { useMinimumFeeCalculator } from './hooks/useMinimumFeeCalculator'
export {
    ProgramSigningUnsupportedError,
    useProgramSigner,
} from './hooks/useProgramSigner'
export {
    UserRejectedSigningError,
    useSignAndSubmitGroup,
    type SignAndSubmitGroupParams,
} from './hooks/useSignAndSubmitGroup'
// The pure applier, not the hook: the app layer owns the AppState
// subscription and feeds it in, keeping this package free of react-native.
export { applyAppStateToHardwareSessions } from './hooks/useSigningActorLifecycle'
export { useSigningEvent } from './hooks/useSigningEvent'
export { useSigningPipeline } from './hooks/useSigningPipeline'
export { useSigningRequest } from './hooks/useSigningRequest'
export { useWalletConnectHandoffResolver } from './hooks/useWalletConnectHandoffResolver'

export { decodeArbitraryDataForDisplay } from './utils/arbitraryDataDisplay'
export {
    ARC60_MAX_REQUEST_BYTES,
    arc60WireSchema,
    assertArc60RequestWithinLimits,
    isArc60OriginMismatch,
    isArc60WirePayload,
    parseArc60WireRequest,
} from './utils/arc60-wire'
export { ARC60_SCOPE_AUTH } from './utils/arc60'
export { assertTransactionsMatchNetwork } from './utils/assertTransactionsMatchNetwork'
export { computeBalanceImpact } from './utils/balanceImpact'
export type {
    GroupTransactionItem,
    SingleTransactionItem,
    TransactionListItem,
} from './utils/classification'
export { classifyLedgerErrorKind } from './utils/classifyLedgerErrorKind'
export {
    getRekeyedUnsignableReason,
    resolveAllSignerAddresses,
} from './utils/getRekeyedUnsignableReason'
export { isSignRequestMultisigUnsignable } from './utils/isSignRequestMultisigUnsignable'
export { encodeDelegatedLsigAccount } from './utils/lsig'
export type { Arc60ParsedPayload } from './utils/parseArc60ForDisplay'
export { buildSiwaAuthRequest, type Siwa } from './utils/siwa'
export { aggregateTransactionWarnings } from './utils/warnings'

export {
    isExternalCallbackSource,
    isInteractiveSource,
    type Arc60Metadata,
    type Arc60SignableData,
    type Arc60StdSigData,
    type RejectReason,
    type SourceType,
    type TransportResult,
} from './pipeline/types'
export { signingEventBus } from './pipeline/signingEventBus'
export type { SigningLifecycleEvent } from './pipeline/signingEvents'
export {
    CannotSignError,
    FeeAdjustmentDeliveryError,
    GenesisHashMismatchError,
    NoLocalParticipantsError,
    SigningError,
    SourceError,
    SubmissionError,
    TransportError,
    UserCancelledError,
    isFeeAdjustmentDeliveryError,
} from './pipeline/errors'
export { resolveMinFeeForSender, type FeeAdjustment } from './pipeline/sources'
export {
    setOnConfirmedHandler,
    submitAndAutoRefresh,
    submitRawSignedTransactionGroup,
} from './pipeline/submission'
export {
    classifyHandoffPoll,
    type HandoffPeerDelivery,
    type ResolverMessages,
    type TerminalHandoffOutcome,
} from './pipeline/classifyHandoffPoll'
export { completeMultisigHandoff } from './pipeline/completeMultisigHandoff'

export {
    deriveSubmissionAttemptFromBytes,
    reconcileOpenSubmissions,
    setSubmissionSettledHandler,
    STALE_OPEN_ATTEMPT_MS,
    type SubmissionAttempt,
} from './ledger'

export {
    getOpenSubmissionAttempts,
    getOpenSubmissionAttemptsForIntent,
    markSubmissionUnknown,
    recordSubmissionAttempt,
    resolveSubmissionAttempt,
} from './db'

export { useHardwareSigningStore } from './store/hardwareSigningStore'

export {
    BLE_CLASS_ERROR_KINDS,
    type LedgerErrorPresetKind,
} from './types/ledgerErrorPresetKind'
