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

// Session / auth
export * from './useCardSession'
export * from './useCardLoginMutation'
export * from './useSendLoginOtpMutation'
export * from './useCardLogout'

// Card lifecycle + status
export * from './useCardStatusQuery'
export * from './useCardIssuance'
export * from './useOrderCardMutation'
export * from './useFreezeCardMutation'
export * from './useUnfreezeCardMutation'
export * from './useIsCardUnfreezing'

// User / profile
export * from './useCardUserQuery'

// Sensitive (imperative, never cached)
export * from './useCardDetailsMutation'
export * from './useCardPinViewMutation'
export * from './useSetCardPinMutation'

// Transactions
export * from './useCardTransactionsQuery'
export * from './useExportCardStatementMutation'

// Funding (deposit / top-up)
export * from './useDepositToCardMutation'

// Internal wallet (balance / withdraw)
export * from './useCardInternalWalletsQuery'
export * from './useWithdrawFromCardMutation'

// Funding delegation (auto-funding LSig lifecycle)
export * from './useCardExternalWalletsQuery'
export * from './useUpdateCardFundingDelegationMutation'
export * from './useSignCardOwnershipMutation'
export * from './useCreateAndApproveCardMutation'
export * from './useKillswitchAutoDraw'

// Onboarding / KYC
export * from './useSendEmailVerificationMutation'
export * from './useVerifyEmailMutation'
export * from './useSendPhoneVerificationMutation'
export * from './useVerifyPhoneMutation'
export * from './useSubmitPersonalDetailsMutation'
export * from './useSubmitAddressMutation'
export * from './useSubmitConsentMutation'
export * from './useLinkConsentMutation'
export * from './useConnectFundingSourceMutation'
export * from './useStartVerificationMutation'
export * from './useOnboardingDetailsQuery'
export * from './useOnboardingKycPoll'
export * from './useRegistrationSettingsQuery'
export * from './useCurrentRegionQuery'
export * from './useRequestCountryAvailabilityMutation'

// Query keys
export {
    cardQueryKeys,
    isCardQuery,
    invalidateCardQueries,
    MODULE_PREFIX,
} from './querykeys'

// Shared hook return shape
export type { CardMutationResult } from './types'
