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

// Card screens that are registered by navigators outside this module: the
// dashboard and its transaction screens by the Home tab's account stack, the
// money flows by the root stack. Declared here as data so the card module keeps
// ownership of its own route names and options, in the same spirit as
// `routes/tab-screens.tsx`.

import type React from 'react'
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack'
import { headeredScreen } from '@routes/screen-options'
import { PeraCardAccountScreen } from '../screens/PeraCardAccountScreen'
import { CardTransactionsScreen } from '../screens/CardTransactionsScreen'
import { CardTransactionDetailScreen } from '../screens/CardTransactionDetailScreen'
import { CardAddFundsScreen } from '../screens/CardAddFundsScreen'
import { CardConfirmSwapScreen } from '../screens/CardConfirmSwapScreen'
import { CardWithdrawScreen } from '../screens/CardWithdrawScreen'
import type {
    PeraCardAccountStackParamList,
    PeraCardFlowParamList,
} from './types'

export type CardScreenDescriptor<ParamList> = {
    name: keyof ParamList & string
    component: React.ComponentType
    options?: NativeStackNavigationOptions
}

/** Hosted by `AccountStackNavigator` (the Home tab), so the tab bar stays up. */
export const peraCardAccountScreens: CardScreenDescriptor<PeraCardAccountStackParamList>[] =
    [
        {
            name: 'PeraCardAccount',
            // Renders its own toolbar, like the wallet account home.
            options: { headerShown: false },
            component: PeraCardAccountScreen as React.ComponentType,
        },
        {
            name: 'CardTransactions',
            options: { title: 'peraCard.transactions.navigation_title' },
            component: CardTransactionsScreen as React.ComponentType,
        },
        {
            name: 'CardTransactionDetail',
            options: { title: '' },
            component: CardTransactionDetailScreen as React.ComponentType,
        },
    ]

/** Hosted by the root stack, so they cover the tab bar while in progress. */
export const peraCardFlowScreens: CardScreenDescriptor<PeraCardFlowParamList>[] =
    [
        {
            name: 'CardAddFunds',
            options: headeredScreen('peraCard.add_funds.navigation_title'),
            component: CardAddFundsScreen as React.ComponentType,
        },
        {
            name: 'CardConfirmSwap',
            options: headeredScreen('peraCard.confirm_swap.navigation_title'),
            component: CardConfirmSwapScreen as React.ComponentType,
        },
        {
            name: 'CardWithdraw',
            options: headeredScreen('peraCard.withdraw.navigation_title'),
            component: CardWithdrawScreen as React.ComponentType,
        },
    ]
