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

export const name = '@perawallet/wallet-core-card'

export * from './models'
export * from './hooks'
export * from './store'
export * from './session'

// Transport seam — lets the app swap in a mock/proxy transport (e.g. dev mocks
// or a future all-proxy mode). Every endpoint calls `getCardTransport()`.
export {
    getCardTransport,
    setCardTransport,
    resetCardTransport,
} from './api/transport/registry'
export type {
    CardTransport,
    CardTransportRequest,
    CardTransportResponse,
} from './api/transport/types'

// Funding seam — the deposit pipeline routes through getCardFundingProvider().
// Defaults to unavailableFundingProvider until the Baanx Algorand provider ships.
export {
    getCardFundingProvider,
    setCardFundingProvider,
    resetCardFundingProvider,
} from './api/funding'

// AutoDraw delegation helpers — the compile → sign → POST /lsig leg, shared by
// onboarding card creation and the post-onboarding funding-type switch.
export {
    compileAutoDrawProgram,
    postDelegatorLsig,
    resolveEscrowChainConfig,
    // Thrown when algod's compiled program doesn't match the pinned bytes.
    // Exported so the funding-type flows can degrade to Manual with honest
    // copy instead of a generic "please try again" (PERA-4712).
    AutoDrawProgramUnverifiedError,
    type EscrowChainConfig,
    type PostDelegatorLsigParams,
} from './api/escrow'

// API error normalization — lets screens attribute a Baanx failure to a field.
export {
    getCardApiError,
    isConflictError,
    isInvalidInputError,
    isDuplicateError,
    isNotVerifiedError,
} from './api/errors'
export type { CardApiError } from './api/errors'

// Card-creation failure types — screens branch on these to pick flow-specific
// copy (the classes carry no user-facing wording of their own).
export {
    CardAccountLinkedElsewhereError,
    CardIntegrityAttestationRequiredError,
    CardUserUnavailableError,
} from './api/card-creation'
export { CardOrderNotVerifiedError } from './api/card'
export { OnboardingNotVerifiedError } from './api/errors'
