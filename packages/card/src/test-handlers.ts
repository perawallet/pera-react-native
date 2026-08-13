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

// Test-only barrel — exposes co-located MSW handler factories without pulling
// them into the production entry (src/index.ts). Consumed only via the test
// alias `@perawallet/wallet-core-card/test-handlers`.

export {
    mockLogin,
    mockOauthAuthorize,
    mockOauthChain,
    mockOauthInitiate,
    mockOauthToken,
    mockPasswordResetConfirm,
    mockPasswordResetRequest,
    mockPasswordResetVerify,
    mockRefreshToken,
    mockSendLoginOtp,
} from './api/auth/msw-handlers'
export type {
    MockLoginParams,
    MockOauthAuthorizeParams,
    MockOauthChainParams,
    MockOauthInitiateParams,
    MockOauthTokenParams,
    MockPasswordResetConfirmParams,
    MockPasswordResetRequestParams,
    MockPasswordResetVerifyParams,
    MockRefreshTokenParams,
    MockSendLoginOtpParams,
} from './api/auth/msw-handlers'

export {
    mockGetCardStatus,
    mockOrderCard,
    mockFreezeCard,
    mockUnfreezeCard,
} from './api/card/msw-handlers'
export type { MockGetCardStatusParams } from './api/card/msw-handlers'

export {
    mockGetUser,
    mockGetVerificationSession,
} from './api/user/msw-handlers'
export type {
    MockGetUserParams,
    MockGetVerificationSessionParams,
} from './api/user/msw-handlers'

export {
    mockCardDetailsToken,
    mockCardPinToken,
    mockSetPinSession,
} from './api/card-sensitive/msw-handlers'
export type {
    MockCardSecureViewParams,
    MockSetPinSessionParams,
} from './api/card-sensitive/msw-handlers'

export {
    mockListCardTransactions,
    mockExportCardStatement,
} from './api/transactions/msw-handlers'
export type { MockListCardTransactionsParams } from './api/transactions/msw-handlers'

export {
    mockGetInternalWallets,
    mockWithdrawFromWallet,
} from './api/wallet/msw-handlers'
export type { MockGetInternalWalletsParams } from './api/wallet/msw-handlers'

export {
    mockGetDelegationToken,
    mockGetDelegationProgram,
    mockPostAlgorandDelegationApproval,
    mockGetExternalWallets,
} from './api/delegation/msw-handlers'
export type {
    MockGetDelegationTokenParams,
    MockGetDelegationProgramParams,
    MockPostAlgorandDelegationApprovalParams,
    MockGetExternalWalletsParams,
} from './api/delegation/msw-handlers'

export {
    mockApproveEscrowCard,
    mockPostDelegatorLsig,
} from './api/escrow/msw-handlers'
export type {
    MockApproveEscrowCardParams,
    MockPostDelegatorLsigParams,
} from './api/escrow/msw-handlers'

export { mockCreateCard } from './api/card-creation/msw-handlers'
export type { MockCreateCardParams } from './api/card-creation/msw-handlers'

export {
    mockSendEmailVerification,
    mockVerifyEmail,
    mockSendPhoneVerification,
    mockVerifyPhone,
    mockSubmitPersonalDetails,
    mockSubmitAddress,
    mockSubmitOnboardingConsent,
    mockLinkOnboardingConsent,
    mockConnectFundingSource,
    mockGetRegistrationSettings,
} from './api/onboarding/msw-handlers'
export type {
    MockConnectFundingSourceParams,
    MockGetRegistrationSettingsParams,
    MockSubmitOnboardingConsentParams,
    MockLinkOnboardingConsentParams,
} from './api/onboarding/msw-handlers'
