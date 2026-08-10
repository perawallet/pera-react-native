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

// Discover is intentionally absent from the web tab registration below (see
// tab-screens.web.tsx's own comment and routes/capabilities.web.ts's discoverTab comment).
import { describe, expect, it, vi } from 'vitest'

const {
    SwapScreen,
    OnrampScreen,
    MenuScreen,
    AccountStackNavigator,
    ageGateCalls,
} = vi.hoisted(() => ({
    SwapScreen: () => null,
    OnrampScreen: () => null,
    MenuScreen: () => null,
    AccountStackNavigator: () => null,
    ageGateCalls: [] as unknown[],
}))

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
import { routeCapabilities } from '../capabilities.web'
import { tabScreens } from '../tab-screens.web'

describe('web tab registration', () => {
    it('registers Home, Swap, Fund, Menu in order, with Discover off pending the web feature-gate fix', () => {
        expect(tabScreens.map(screen => screen.name)).toEqual([
            'Home',
            'Swap',
            'Fund',
            'Menu',
        ])
    })

    it('age-gates Swap and Fund like native, and never age-gates a Discover screen', () => {
        expect(ageGateCalls).toContain(SwapScreen)
        expect(ageGateCalls).toContain(OnrampScreen)
        expect(ageGateCalls).toHaveLength(2)
    })

    it('mirrors native layouts and exposes e2e tab testIDs', () => {
        const swap = tabScreens.find(screen => screen.name === 'Swap')
        const fund = tabScreens.find(screen => screen.name === 'Fund')
        expect(swap?.layout).toBe(safeAreaLayout)
        expect(swap?.options?.tabBarButtonTestID).toBe('tab_swap_button')
        expect(fund?.layout).toBe(headeredLayout)
        expect(fund?.options?.tabBarButtonTestID).toBe('tab_fund_button')
    })

    it('has no Discover descriptor, kept in lockstep with the capability flag being off', () => {
        const discover = tabScreens.find(screen => screen.name === 'Discover')
        expect(discover).toBeUndefined()
        expect(routeCapabilities.discoverTab).toBe(false)
    })
})
