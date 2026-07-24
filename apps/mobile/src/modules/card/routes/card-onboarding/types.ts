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

import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { FundingType } from '@perawallet/wallet-core-card'

// The flow's data (email, country, verification code, ids) lives in the card
// store, so screens don't thread it through navigation params.
export type CardOnboardingStackParamList = {
    CardOnboardingEmail: undefined
    CardOnboardingEmailVerify: undefined
    CardOnboardingPhone: undefined
    CardOnboardingPhoneVerify: undefined
    CardOnboardingPassword: undefined
    CardOnboardingVerification: undefined
    // One-shot flag from the add-account returnTo: on arrival, link the
    // just-created (globally selected) account as the funding source.
    CardOnboardingStatus: { autoConnectSelected?: boolean }
    CardOnboardingPersonalDetails: undefined
    CardOnboardingAddress: undefined
    // The funding type chosen on the status screen; the signing screen reads
    // the connected account itself from the card store.
    CardOnboardingSigning: { fundingType: FundingType }
    // Step 3 (Auto funding only) — reads the connected account and the
    // just-created card address from the card store.
    CardOnboardingAutoFundingSigning: undefined
}

export type CardOnboardingScreenProps<
    T extends keyof CardOnboardingStackParamList,
> = NativeStackScreenProps<CardOnboardingStackParamList, T>
