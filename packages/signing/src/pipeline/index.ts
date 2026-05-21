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

// Core types
export * from './types'

// Errors
export * from './errors'

// Sources
export * from './sources'

// Analyzers
export * from './analyzers'

// Signing strategies
export * from './signing'

// Transports
export * from './transports'

// Submission helpers (low-level algod submission — prefer the pipeline for
// end-to-end flows, but exposed for callers that merge pre-signed bytes).
export * from './submission'

// Sync-flow WalletConnect handoff registry. Populated by the multisig
// propose transport; consumed by the app-side resolver listener.
export {
    walletConnectHandoffs,
    type PendingWalletConnectHandoff,
} from './walletConnectHandoffs'

// Sync-flow handoff classification + delivery. Pure functions consumed by
// the resolver hook (`useWalletConnectHandoffResolver`).
export {
    classifyHandoffPoll,
    resolveHandoffOutcome,
    errorReasonToMessage,
    type HandoffPollDetail,
    type ResolverMessages,
    type HandoffErrorReason,
    type HandoffPollOutcome,
    type TerminalHandoffOutcome,
} from './classifyHandoffPoll'
