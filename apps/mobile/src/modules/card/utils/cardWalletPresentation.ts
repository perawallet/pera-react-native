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

import type { ImageSourcePropType } from 'react-native'
import { type I18nKey, i18nKey } from '@perawallet/wallet-core-chain-contract'
import { CardWalletKind } from '@perawallet/wallet-core-card'
import { CardEvent } from '@analytics'
import rewardsHero from '@assets/images/rewards-hero.png'

/**
 * Every user-facing string that differs between the two claimable wallets, as
 * literal i18n keys so the translation linter can see them. Shared claim-flow
 * copy (buttons, fee row, errors) lives under `peraCard.credits.*` and is used
 * directly by the screens.
 */
export type CardWalletCopy = Record<
    | 'navigationTitle'
    | 'withdrawNavigationTitle'
    | 'balanceLabel'
    | 'emptyTitle'
    | 'emptyBody'
    | 'howTitle'
    | 'howFirstTitle'
    | 'howFirstBody'
    | 'howSecondTitle'
    | 'howSecondBody'
    | 'body'
    | 'notWithdrawableBody'
    | 'confirmBody'
    | 'successBody',
    I18nKey
>

export type CardWalletPresentation = {
    hero: ImageSourcePropType
    /** Fired when the wallet is opened from the dashboard credits rows. */
    homeEvent: CardEvent.HomeRewards | CardEvent.HomeRefunds
    copy: CardWalletCopy
}

// The refunds wallet reuses the rewards artwork until design supplies its own.
export const CARD_WALLET_PRESENTATION: Record<
    CardWalletKind,
    CardWalletPresentation
> = {
    [CardWalletKind.Reward]: {
        hero: rewardsHero as ImageSourcePropType,
        homeEvent: CardEvent.HomeRewards,
        copy: {
            navigationTitle: i18nKey('peraCard.rewards.navigation_title'),
            withdrawNavigationTitle: i18nKey(
                'peraCard.rewards.withdraw_navigation_title',
            ),
            balanceLabel: i18nKey('peraCard.rewards.balance_label'),
            emptyTitle: i18nKey('peraCard.rewards.empty_title'),
            emptyBody: i18nKey('peraCard.rewards.empty_body'),
            howTitle: i18nKey('peraCard.rewards.how_title'),
            howFirstTitle: i18nKey('peraCard.rewards.how_first_title'),
            howFirstBody: i18nKey('peraCard.rewards.how_first_body'),
            howSecondTitle: i18nKey('peraCard.rewards.how_second_title'),
            howSecondBody: i18nKey('peraCard.rewards.how_second_body'),
            body: i18nKey('peraCard.rewards.body'),
            notWithdrawableBody: i18nKey(
                'peraCard.rewards.not_withdrawable_body',
            ),
            confirmBody: i18nKey('peraCard.rewards.confirm_body'),
            successBody: i18nKey('peraCard.rewards.success_body'),
        },
    },
    [CardWalletKind.Credit]: {
        hero: rewardsHero as ImageSourcePropType,
        homeEvent: CardEvent.HomeRefunds,
        copy: {
            navigationTitle: i18nKey('peraCard.refunds.navigation_title'),
            withdrawNavigationTitle: i18nKey(
                'peraCard.refunds.withdraw_navigation_title',
            ),
            balanceLabel: i18nKey('peraCard.refunds.balance_label'),
            emptyTitle: i18nKey('peraCard.refunds.empty_title'),
            emptyBody: i18nKey('peraCard.refunds.empty_body'),
            howTitle: i18nKey('peraCard.refunds.how_title'),
            howFirstTitle: i18nKey('peraCard.refunds.how_first_title'),
            howFirstBody: i18nKey('peraCard.refunds.how_first_body'),
            howSecondTitle: i18nKey('peraCard.refunds.how_second_title'),
            howSecondBody: i18nKey('peraCard.refunds.how_second_body'),
            body: i18nKey('peraCard.refunds.body'),
            notWithdrawableBody: i18nKey(
                'peraCard.refunds.not_withdrawable_body',
            ),
            confirmBody: i18nKey('peraCard.refunds.confirm_body'),
            successBody: i18nKey('peraCard.refunds.success_body'),
        },
    },
}
