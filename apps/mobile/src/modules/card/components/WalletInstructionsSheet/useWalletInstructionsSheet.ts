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

import { useLanguage } from '@hooks/useLanguage'

export type WalletPlatform = 'apple' | 'google'

const APPLE_STEP_KEYS = [
    'peraCard.wallet_instructions.apple_step_1',
    'peraCard.wallet_instructions.apple_step_2',
    'peraCard.wallet_instructions.apple_step_3',
    'peraCard.wallet_instructions.apple_step_4',
    'peraCard.wallet_instructions.apple_step_5',
] as const

const GOOGLE_STEP_KEYS = [
    'peraCard.wallet_instructions.google_step_1',
    'peraCard.wallet_instructions.google_step_2',
    'peraCard.wallet_instructions.google_step_3',
    'peraCard.wallet_instructions.google_step_4',
    'peraCard.wallet_instructions.google_step_5',
    'peraCard.wallet_instructions.google_step_6',
    'peraCard.wallet_instructions.google_step_7',
] as const

type UseWalletInstructionsSheetResult = {
    /** Sheet title; reuses the Card Details row labels. */
    title: string
    /** Ordered, translated manual-add steps for the platform. */
    steps: string[]
}

export const useWalletInstructionsSheet = (
    platform: WalletPlatform,
): UseWalletInstructionsSheetResult => {
    const { t } = useLanguage()
    const isApple = platform === 'apple'

    return {
        title: t(
            isApple
                ? 'peraCard.account.add_to_apple_wallet'
                : 'peraCard.account.add_to_google_pay',
        ),
        steps: (isApple ? APPLE_STEP_KEYS : GOOGLE_STEP_KEYS).map(key =>
            t(key),
        ),
    }
}
