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

import { i18nKey } from '@perawallet/wallet-core-chain-contract'
import { useLanguage } from '@hooks/useLanguage'

export type WalletPlatform = 'apple' | 'google'

const APPLE_STEP_KEYS = [
    i18nKey('peraCard.wallet_instructions.apple_step_1'),
    i18nKey('peraCard.wallet_instructions.apple_step_2'),
    i18nKey('peraCard.wallet_instructions.apple_step_3'),
    i18nKey('peraCard.wallet_instructions.apple_step_4'),
    i18nKey('peraCard.wallet_instructions.apple_step_5'),
] as const

const GOOGLE_STEP_KEYS = [
    i18nKey('peraCard.wallet_instructions.google_step_1'),
    i18nKey('peraCard.wallet_instructions.google_step_2'),
    i18nKey('peraCard.wallet_instructions.google_step_3'),
    i18nKey('peraCard.wallet_instructions.google_step_4'),
    i18nKey('peraCard.wallet_instructions.google_step_5'),
    i18nKey('peraCard.wallet_instructions.google_step_6'),
    i18nKey('peraCard.wallet_instructions.google_step_7'),
] as const

/** One ordered step; `id` is the stable i18n key (used as the React key). */
type WalletInstructionStepItem = { id: string; text: string }

type UseWalletInstructionsSheetResult = {
    title: string
    /** Ordered, translated manual-add steps for the platform. */
    steps: WalletInstructionStepItem[]
}

export const useWalletInstructionsSheet = (
    platform: WalletPlatform,
): UseWalletInstructionsSheetResult => {
    const { t } = useLanguage()
    const isApple = platform === 'apple'

    return {
        title: t(
            isApple
                ? i18nKey('peraCard.wallet_instructions.apple_title')
                : i18nKey('peraCard.wallet_instructions.google_title'),
        ),
        steps: (isApple ? APPLE_STEP_KEYS : GOOGLE_STEP_KEYS).map(key => ({
            id: key,
            text: t(key),
        })),
    }
}
