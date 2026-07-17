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

// Web tab registration (see capabilities.web.ts): Discover/Swap/Fund are off
// in extension v1, and keeping their imports out of this platform file keeps
// their native-heavy screen graphs out of the web bundle entirely.
import type React from 'react'
import { TabbarEvent } from '@analytics'
import { MenuScreen } from '@modules/menu/screens/MenuScreen'
import { AccountStackNavigator } from '@modules/accounts/routes'
import { safeAreaLayout } from '@layouts/index'
import type { TabScreenDescriptor } from './tab-screens'

export type {
    TabScreenDescriptor,
    TabScreenLayout,
    TabScreenOptions,
} from './tab-screens'

export const tabScreens: TabScreenDescriptor[] = [
    {
        name: 'Home',
        component: AccountStackNavigator as React.ComponentType,
        event: TabbarEvent.Home,
    },
    {
        name: 'Menu',
        component: MenuScreen as React.ComponentType,
        layout: safeAreaLayout,
        options: { tabBarButtonTestID: 'tab_menu_button' },
        event: TabbarEvent.Menu,
    },
]
