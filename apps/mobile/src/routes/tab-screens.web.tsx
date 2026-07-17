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

// Web tab registration (see capabilities.web.ts): Discover stays off until
// the M6 iframe/bridge layer exists, and keeping its import out of this
// platform file keeps the webview screen graph out of the web bundle
// entirely. Swap and Fund are pure RN screen graphs, registered as of M5
// (2026-07-16 feature-completion spec) with native's layouts and age gates.
import type React from 'react'
import { withAgeGate } from '@components/AgeGated'
import { TabbarEvent } from '@analytics'
import { SwapScreen } from '@modules/swap/screens/SwapScreen'
import { OnrampScreen } from '@modules/onramp/screens/OnrampScreen'
import { MenuScreen } from '@modules/menu/screens/MenuScreen'
import { AccountStackNavigator } from '@modules/accounts/routes'
import { headeredLayout, safeAreaLayout } from '@layouts/index'
import type { TabScreenDescriptor } from './tab-screens'

export type {
    TabScreenDescriptor,
    TabScreenLayout,
    TabScreenOptions,
} from './tab-screens'

// Age-gated at the navigator so the screens (and their side effects) only
// mount for users who pass the gate (same rule as native tab-screens.tsx).
const GatedSwapScreen = withAgeGate(SwapScreen)
const GatedOnrampScreen = withAgeGate(OnrampScreen)

export const tabScreens: TabScreenDescriptor[] = [
    {
        name: 'Home',
        component: AccountStackNavigator as React.ComponentType,
        event: TabbarEvent.Home,
    },
    {
        name: 'Swap',
        component: GatedSwapScreen as React.ComponentType,
        layout: safeAreaLayout,
        options: { tabBarButtonTestID: 'tab_swap_button' },
        event: TabbarEvent.Swap,
    },
    {
        name: 'Fund',
        component: GatedOnrampScreen as React.ComponentType,
        layout: headeredLayout,
        options: { tabBarButtonTestID: 'tab_fund_button' },
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
