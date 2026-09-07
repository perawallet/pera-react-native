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

import type { NavigatorScreenParams } from '@react-navigation/native'
import type { CardOnboardingStackParamList } from './card-onboarding/types'

/**
 * The card dashboard is an account home, so it lives in the Home tab's account
 * stack and keeps the bottom tab bar; its transaction screens follow it there
 * the way `AssetDetails` sits behind a wallet account.
 *
 * Merged into `AccountStackParamsList`; registered by `AccountStackNavigator`.
 */
export type PeraCardAccountStackParamList = {
    PeraCardAccount: undefined
    CardTransactions: undefined
    // The row's internal `id` (the list key) — NOT the model's external
    // `transactionId` field. The full object can't be passed: it holds Decimal
    // instances, which aren't serializable navigation state.
    CardTransactionDetail: { id: string }
}

/**
 * The card money flows, registered on the root stack like `Staking` and
 * `TransactionDetails`: they cover the tab bar, and reaching them doesn't mount
 * `PeraCardStackNavigator` (intro, sign-in and the whole onboarding stack) just
 * to show one screen.
 *
 * Merged into `RootStackParamList`.
 */
export type PeraCardFlowParamList = {
    CardAddFunds: undefined
    CardConfirmSwap: { sourceAssetId: string; amount: string }
    CardWithdraw: undefined
}

/**
 * The root-level card stack, entered before the user has a usable card:
 * the marketing intro, sign-in, and the onboarding flow.
 */
export type PeraCardStackParamList = {
    PeraCardIntro: undefined
    // `email` prefills the sign-in form: handed back by the forgot-password
    // flow so the user returns to a ready-to-submit screen.
    CardSignIn: { email?: string } | undefined
    CardOnboarding: NavigatorScreenParams<CardOnboardingStackParamList>
    // Forgot-password flow. Its state rides in params, NOT the card store:
    // the store persists to disk and the reset token is a short-lived,
    // single-use secret. `email` rides along to the last screen so it can be
    // handed back to CardSignIn.
    CardForgotPassword: { email?: string } | undefined
    CardForgotPasswordVerify: { email: string }
    CardForgotPasswordNewPassword: { email: string; token: string }
}
