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

import { describe, expect, it, vi } from 'vitest'

const {
    DiscoverScreen,
    SwapScreen,
    OnrampScreen,
    MenuScreen,
    AccountStackNavigator,
    ageGateCalls,
} = vi.hoisted(() => ({
    DiscoverScreen: () => null,
    SwapScreen: () => null,
    OnrampScreen: () => null,
    MenuScreen: () => null,
    AccountStackNavigator: () => null,
    ageGateCalls: [] as unknown[],
}))

vi.mock('@modules/discover/screens/DiscoverScreen', () => ({ DiscoverScreen }))
vi.mock('@modules/swap/screens/SwapScreen', () => ({ SwapScreen }))
vi.mock('@modules/onramp/screens/OnrampScreen', () => ({ OnrampScreen }))
vi.mock('@modules/menu/screens/MenuScreen', () => ({ MenuScreen }))
vi.mock('@modules/accounts/routes', () => ({ AccountStackNavigator }))
// Record age-gate wrapping via plain array (survives afterEach clearAllMocks):
// module-scope calls happen at import time, before test 1 runs, so call history
// from vi.fn would be wiped before test 2 checks it. Plain array persists.
vi.mock('@components/AgeGated', () => ({
    withAgeGate: (component: unknown) => {
        ageGateCalls.push(component)
        return component
    },
}))
vi.mock('@layouts/index', () => ({
    safeAreaLayout: vi.fn(),
    headeredLayout: vi.fn(),
}))
vi.mock('@analytics', () => ({
    TabbarEvent: {
        Home: 'tabbar_home',
        Discover: 'tabbar_discover',
        Swap: 'tabbar_swap',
        Fund: 'tabbar_fund',
        Menu: 'tabbar_menu',
    },
}))

import { headeredLayout, safeAreaLayout } from '@layouts/index'
import { tabScreens } from '../tab-screens.web'

describe('web tab registration', () => {
    it('registers Home, Discover, Swap, Fund, Menu in native order', () => {
        expect(tabScreens.map(screen => screen.name)).toEqual([
            'Home',
            'Discover',
            'Swap',
            'Fund',
            'Menu',
        ])
    })

    it('age-gates Discover, Swap and Fund exactly like native', () => {
        expect(ageGateCalls).toContain(DiscoverScreen)
        expect(ageGateCalls).toContain(SwapScreen)
        expect(ageGateCalls).toContain(OnrampScreen)
        expect(ageGateCalls).toHaveLength(3)
    })

    it('mirrors native layouts and exposes e2e tab testIDs', () => {
        const discover = tabScreens.find(screen => screen.name === 'Discover')
        const swap = tabScreens.find(screen => screen.name === 'Swap')
        const fund = tabScreens.find(screen => screen.name === 'Fund')
        expect(discover?.layout).toBe(headeredLayout)
        expect(discover?.options?.tabBarButtonTestID).toBe(
            'tab_discover_button',
        )
        expect(swap?.layout).toBe(safeAreaLayout)
        expect(swap?.options?.tabBarButtonTestID).toBe('tab_swap_button')
        expect(fund?.layout).toBe(headeredLayout)
        expect(fund?.options?.tabBarButtonTestID).toBe('tab_fund_button')
    })
})
