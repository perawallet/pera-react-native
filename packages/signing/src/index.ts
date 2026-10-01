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
    computeBalanceImpact,
    encodeProgramAccount,
    plannerAdapterFor,
    plannerChainAdapters,
    resolveMinFeeForSender,
    type AssignFeeToGroup,
    type AssignFeeToGroupDeps,
    type AssignFeeToGroupParams,
    type AssignMinimumFeesToGroupResult,
    type BalanceImpact,
    type BalanceImpactCreatedAsset,
    type BalanceImpactDelta,
    type DappResolveContext,
    type DappResolveResult,
    type DappSignRequest,
    type EnqueueDappRequestDeps,
    type GroupFeeReview,
    type PlannerChainAdapter,
    type ResolveMinFeeForSenderParams,
} from './chain-adapter'

export {
    MAX_DATA_SIGN_REQUESTS,
    MAX_TRANSACTION_SIGN_REQUESTS,
} from './constants'

export {
    isArbitraryDataRequest,
    isArc60Request,
    isTransactionRequest,
    type ArbitraryDataSignRequest,
    type Arc60SignRequest,
    type FeeAdjustment,
    type FeeAdjustmentReason,
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

export {
    LEGACY_DATA_MAX_ITEM_CHARS,
    LEGACY_DATA_MAX_REQUEST_CHARS,
    legacyArbitraryDataWireSchema,
} from './utils/arbitrary-data-wire'
export {
    ARC60_MAX_REQUEST_BYTES,
    arc60WireSchema,
    assertArc60RequestWithinLimits,
    isArc60OriginMismatch,
    isArc60WirePayload,
    parseArc60WireRequest,
} from './utils/arc60-wire'
export { ARC60_SCOPE_AUTH } from './utils/arc60'
export { buildWalletConnectSignResult } from './utils/buildWalletConnectSignResult'
export { classifyLedgerErrorKind } from './utils/classifyLedgerErrorKind'
export { isSignRequestMultisigUnsignable } from './utils/isSignRequestMultisigUnsignable'
export type { Arc60ParsedPayload } from './utils/parseArc60ForDisplay'
export { buildSiwaAuthRequest, type Siwa } from './utils/siwa'
export {
    aggregateTransactionWarnings,
    decodeArbitraryDataForDisplay,
    getRekeyedUnsignableReason,
    resolveAllSignerAddresses,
    reviewerChainAdapters,
    type ArbitraryDataDisplay,
    type GroupTransactionItem,
    type DelegatedUnsignableReason,
    type RequestStructure,
    type ReviewerChainAdapter,
    type SingleTransactionItem,
    type TransactionListItem,
} from './chain-adapter'

export {
    isExternalCallbackSource,
    isInteractiveSource,
    type AlgorandTransactionSummary,
    type AnalysisContext,
    type AnalysisWarning,
    type Arc60Metadata,
    type Arc60SignableData,
    type Arc60StdSigData,
    type DataAnalyzer,
    type RejectReason,
    type DataTransport,
    type SigningResult,
    type SourceMetadata,
    type SignableAnalysis,
    type SignableGroup,
    type SourceType,
    type TransportResult,
} from './pipeline/types'
export { signingEventBus } from './pipeline/signingEventBus'
export type { SigningLifecycleEvent } from './pipeline/signingEvents'
export {
    AnalysisError,
    CannotSignError,
    FEE_ADJUSTMENT_DELIVERY_MESSAGE_MARKER,
    FeeAdjustmentDeliveryError,
    GenesisHashMismatchError,
    InvalidSignableDataError,
    NetworkChangedError,
    NoLocalParticipantsError,
    SigningError,
    SourceError,
    SubmissionError,
    TransactionRoundTripError,
    TransportError,
    UserCancelledError,
    isFeeAdjustmentDeliveryError,
} from './pipeline/errors'
export {
    classifyHandoffPoll,
    type HandoffPeerDelivery,
    type ResolverMessages,
    type TerminalHandoffOutcome,
} from './pipeline/classifyHandoffPoll'
export { completeMultisigHandoff } from './pipeline/completeMultisigHandoff'

export {
    broadcasterChainAdapters,
    deriveSubmissionAttemptFromBytes,
    reconcileOpenSubmissions,
    setOnConfirmedHandler,
    setSubmissionSettledHandler,
    submitAndAutoRefresh,
    type BroadcasterChainAdapter,
    type DerivedSubmissionAttempt,
    type OnConfirmedHandler,
    type ReconcileSummary,
    type SubmissionSettledHandler,
    type SubmitAndAutoRefreshOptions,
} from './broadcaster'

export {
    getOpenSubmissionAttempts,
    getOpenSubmissionAttemptsForIntent,
    getSubmissionAttemptsByTxIds,
    LANDABLE_SUBMISSION_STATUSES,
    markSubmissionUnknown,
    pruneResolvedSubmissionAttempts,
    recordSubmissionAttempt,
    resolveSubmissionAttempt,
    STALE_OPEN_ATTEMPT_MS,
    SubmissionAttemptsSchema,
    type IntentKey,
    type SubmissionAttempt,
    type SubmissionFlow,
    type SubmissionStatus,
} from './db'

export { useHardwareSigningStore } from './store/hardwareSigningStore'

export {
    BLE_CLASS_ERROR_KINDS,
    type LedgerErrorPresetKind,
} from './types/ledgerErrorPresetKind'
