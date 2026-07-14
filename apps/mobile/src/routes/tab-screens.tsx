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

import type React from 'react'
import { withAgeGate } from '@components/AgeGated'
import { TabbarEvent } from '@analytics'
import { DiscoverScreen } from '@modules/discover/screens/DiscoverScreen'
import { OnrampScreen } from '@modules/onramp/screens/OnrampScreen'
import { SwapScreen } from '@modules/swap/screens/SwapScreen'
import { MenuScreen } from '@modules/menu/screens/MenuScreen'
import { AccountStackNavigator } from '@modules/accounts/routes'
import { headeredLayout, safeAreaLayout } from '@layouts/index'
import type { TabBarStackParamList } from './tab-types'

// Age-gated at the navigator so the screens (and their side effects) only
// mount for users who pass the gate (moved verbatim from tabbar.tsx).
const GatedDiscoverScreen = withAgeGate(DiscoverScreen)
const GatedSwapScreen = withAgeGate(SwapScreen)
const GatedOnrampScreen = withAgeGate(OnrampScreen)

/** Shared shape of `@layouts/index`'s layout wrappers (`headeredLayout`, `safeAreaLayout`, …). */
export type TabScreenLayout = (props: {
    children: React.ReactNode
}) => React.ReactElement

export type TabScreenOptions = {
    tabBarButtonTestID?: string
}

export type TabScreenDescriptor = {
    name: keyof TabBarStackParamList
    component: React.ComponentType
    layout?: TabScreenLayout
    options?: TabScreenOptions
    event: TabbarEvent
}

export const tabScreens: TabScreenDescriptor[] = [
    {
        name: 'Home',
        component: AccountStackNavigator as React.ComponentType,
        event: TabbarEvent.Home,
    },
    {
        name: 'Discover',
        component: GatedDiscoverScreen as React.ComponentType,
        layout: headeredLayout,
        event: TabbarEvent.Discover,
    },
    {
        name: 'Swap',
        component: GatedSwapScreen as React.ComponentType,
        layout: safeAreaLayout,
        event: TabbarEvent.Swap,
    },
    {
        name: 'Fund',
        component: GatedOnrampScreen as React.ComponentType,
        layout: headeredLayout,
        event: TabbarEvent.Fund,
    },
    {
        name: 'Menu',
        component: MenuScreen as React.ComponentType,
        layout: safeAreaLayout,
        options: { tabBarButtonTestID: 'tab_menu_button' },
        event: TabbarEvent.Menu,
    },
]
