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
    string
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
            navigationTitle: 'peraCard.rewards.navigation_title',
            withdrawNavigationTitle:
                'peraCard.rewards.withdraw_navigation_title',
            balanceLabel: 'peraCard.rewards.balance_label',
            emptyTitle: 'peraCard.rewards.empty_title',
            emptyBody: 'peraCard.rewards.empty_body',
            howTitle: 'peraCard.rewards.how_title',
            howFirstTitle: 'peraCard.rewards.how_first_title',
            howFirstBody: 'peraCard.rewards.how_first_body',
            howSecondTitle: 'peraCard.rewards.how_second_title',
            howSecondBody: 'peraCard.rewards.how_second_body',
            body: 'peraCard.rewards.body',
            notWithdrawableBody: 'peraCard.rewards.not_withdrawable_body',
            confirmBody: 'peraCard.rewards.confirm_body',
            successBody: 'peraCard.rewards.success_body',
        },
    },
    [CardWalletKind.Credit]: {
        hero: rewardsHero as ImageSourcePropType,
        homeEvent: CardEvent.HomeRefunds,
        copy: {
            navigationTitle: 'peraCard.refunds.navigation_title',
            withdrawNavigationTitle:
                'peraCard.refunds.withdraw_navigation_title',
            balanceLabel: 'peraCard.refunds.balance_label',
            emptyTitle: 'peraCard.refunds.empty_title',
            emptyBody: 'peraCard.refunds.empty_body',
            howTitle: 'peraCard.refunds.how_title',
            howFirstTitle: 'peraCard.refunds.how_first_title',
            howFirstBody: 'peraCard.refunds.how_first_body',
            howSecondTitle: 'peraCard.refunds.how_second_title',
            howSecondBody: 'peraCard.refunds.how_second_body',
            body: 'peraCard.refunds.body',
            notWithdrawableBody: 'peraCard.refunds.not_withdrawable_body',
            confirmBody: 'peraCard.refunds.confirm_body',
            successBody: 'peraCard.refunds.success_body',
        },
    },
}
