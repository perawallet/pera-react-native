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
    classifyHandoffPoll,
    completeMultisigHandoff,
    computeBalanceImpact,
    encodeProgramAccount,
    isSignRequestMultisigUnsignable,
    localKeySignerAdapterFor,
    localKeySignerChainAdapters,
    plannerAdapterFor,
    plannerChainAdapters,
    resolveMinFeeForSender,
    type AddSignaturesFn,
    type AssignFeeToGroup,
    type AssignFeeToGroupDeps,
    type AssignFeeToGroupParams,
    type AssignMinimumFeesToGroupResult,
    type BalanceImpact,
    type BalanceImpactCreatedAsset,
    type BalanceImpactDelta,
    type CompleteMultisigHandoffArgs,
    type CreateDraftSignRequestFn,
    type CreateDraftSignRequestInput,
    type CreateMultisigStrategyOptions,
    type DappResolveContext,
    type DappResolveResult,
    type ChainFeeConfig,
    type DappSignRequest,
    type DraftProposeContext,
    type EnqueueDappRequestDeps,
    type FetchSuggestedMinFee,
    type FetchSuggestedMinFeeOptions,
    type GetDeviceIdFn,
    type GetMsigMetadataFn,
    type GroupFeeReview,
    type HandoffAssemblyContext,
    type HandoffErrorReason,
    type HandoffPeerDelivery,
    type HandoffPollDetail,
    type HandoffPollOutcome,
    type LocalArbitrarySigningFunction,
    type LocalAuthDataSigningFunction,
    type LocalKeySignerChainAdapter,
    type LocalKeySignerInput,
    type LocalKeySigningDeps,
    type LocalKeyStrategyOptions,
    type LocalSigningFunction,
    type MinFeeForSenderResult,
    type MsigMetadata,
    type MultisigHandoffCompletionDeps,
    type MultisigSignerInput,
    type PQSigningInfo,
    type PlannerChainAdapter,
    type ProposeSignRequestFn,
    type ResolveHandoffOutcomeArgs,
    type ResolveMinFeeForSenderParams,
    type ResolverMessages,
    type TerminalHandoffOutcome,
    type UseSuggestedMinFeeQueryResult,
} from './chain-adapter'

export {
    MAX_DATA_SIGN_REQUESTS,
    MAX_TRANSACTION_SIGN_REQUESTS,
} from './constants'

export {
    isArbitraryDataRequest,
    isAuthDataRequest,
    isTransactionRequest,
    isUnsignedTransaction,
    isUnsignedTransactionRequest,
    type PeraTransactionSignRequest,
    type UnsignedTransactionSignRequest,
    type ArbitraryDataSignRequest,
    type AuthDataSignRequest,
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
export {
    useFeeConfig,
    useFetchSuggestedMinFee,
    useSuggestedMinFeeQuery,
} from './hooks/chainFees'
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
export {
    applyAppStateToHardwareSessions,
    isSignRequestAwaitingPreflight,
} from './hooks/useSigningActorLifecycle'
export { useSigningEvent } from './hooks/useSigningEvent'
export { useSigningPipeline } from './hooks/useSigningPipeline'
export { useSigningRequest } from './hooks/useSigningRequest'
export { useWalletConnectHandoffResolver } from './hooks/useWalletConnectHandoffResolver'

export {
    LEGACY_DATA_MAX_ITEM_CHARS,
    LEGACY_DATA_MAX_REQUEST_CHARS,
    legacyArbitraryDataWireSchema,
} from './utils/arbitrary-data-wire'
export { isAuthDataOriginMismatch } from './utils/authDataOrigin'
export { classifyLedgerErrorKind } from './utils/classifyLedgerErrorKind'
export {
    buildSiwxAuthData,
    isAuthDataWirePayload,
    messageSignerChainAdapters,
    parseAuthDataWireRequest,
    type BuildSiwxAuthDataArgs,
    type MessageSignerChainAdapter,
    type MessageSigningDeps,
    type ParsedAuthData,
    type SiwxMessage,
} from './message-signer'
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
    type ReviewPolicy,
    type SingleTransactionItem,
    type TransactionDecoder,
    type TransactionListItem,
    type WarningDetector,
} from './chain-adapter'
export { composeAnalysis, reviewGroup } from './pipeline/composeAnalysis'

export {
    isExternalCallbackSource,
    isInteractiveSource,
    isUnsignedTransactionsData,
    type AlgorandGroupData,
    type AlgorandTransactionSummary,
    type AnalysisContext,
    type AnalysisWarning,
    type ArbitraryDataSignableData,
    type AuthDataMetadata,
    type AuthDataPayload,
    type AuthDataSignableData,
    type AuthData,
    type DecodedGroup,
    type PeraTransactionsSignableData,
    type TransactionSignableData,
    type UnsignedTransactionsSignableData,
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
    NoLocalParticipantsError,
    ReviewRequiredError,
    SigningError,
    SourceError,
    SubmissionError,
    TransactionRoundTripError,
    TransportError,
    UserCancelledError,
    isFeeAdjustmentDeliveryError,
} from './pipeline/errors'
export { walletConnectHandoffs } from './pipeline/walletConnectHandoffs'
export type { PendingWalletConnectHandoff } from './pipeline/walletConnectHandoffs'
export { createSigningStrategySelector } from './pipeline/signing/getSigningStrategy'
export type { EncodeTransactionFunction } from './pipeline/signing/createHardwareStrategy'
export { SIGNING_ERROR_KEYS } from './pipeline/errors'
export { resolveSigningAccount } from './machine/utils/resolveSigningAccount'
export {
    resolveSignerCredential,
    type SignerCredential,
    type SignerCustody,
} from './machine/utils/resolveSignerCredential'
export { signGroupsBySignerAccount } from './machine/actors/signers/signGroupsBySignerAccount'
export type {
    AnalyzedSignableGroup,
    SignedData,
    SignerInfo,
    SigningCallbacks,
    SigningStrategy,
    SignRequestStatus,
} from './pipeline/types'

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
    type StaleGroupReason,
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
