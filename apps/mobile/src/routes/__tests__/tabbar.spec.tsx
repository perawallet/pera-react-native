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

import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { TabBarStackNavigator } from '../tabbar'

vi.mock('@react-navigation/bottom-tabs', () => ({
    createBottomTabNavigator: () => ({
        Navigator: ({ children }: { children: React.ReactNode }) => (
            <div>{children}</div>
        ),
        Screen: ({ name }: { name: string }) => (
            <div data-testid={`tab_${name}`} />
        ),
    }),
}))

vi.mock('@modules/accounts', () => ({
    AccountDrawer: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@modules/accounts/routes', () => ({
    AccountStackNavigator: () => null,
}))
vi.mock('@modules/discover/routes', () => ({ DiscoverScreen: () => null }))
vi.mock('@modules/swap/routes', () => ({ SwapScreen: () => null }))
vi.mock('@modules/onramp/routes', () => ({ OnrampScreen: () => null }))
vi.mock('@modules/menu/routes', () => ({ MenuScreen: () => null }))
vi.mock('@components/AgeGated', () => ({
    withAgeGate: (component: unknown) => component,
}))
vi.mock('@layouts/index', () => ({
    safeAreaLayout: vi.fn(),
    headeredLayout: vi.fn(),
}))
vi.mock('@components/TabLabel', () => ({ TabLabel: () => null }))
vi.mock('../tab-transitions', () => ({ getTabTransition: () => ({}) }))
vi.mock('../listeners', () => ({ screenListeners: {} }))
vi.mock('@analytics', () => ({
    trackEvent: vi.fn(),
    TabbarEvent: {
        Home: 'tabbar_home',
        Discover: 'tabbar_discover',
        Swap: 'tabbar_swap',
        Fund: 'tabbar_fund',
        Menu: 'tabbar_menu',
    },
}))

const renderedTabs = (): string[] =>
    screen
        .queryAllByTestId(/^tab_/)
        .map(tab => tab.getAttribute('data-testid')!.replace('tab_', ''))

describe('TabBarStackNavigator', () => {
    beforeEach(() => {
        useRemoteConfigStore.getState().resetState()
    })

    it('shows every tab at the Algorand defaults', () => {
        render(<TabBarStackNavigator />)

        expect(renderedTabs()).toEqual([
            'Home',
            'Discover',
            'Swap',
            'Fund',
            'Menu',
        ])
    })

    it('removes the Discover tab when its capability is off', () => {
        setCapabilityOverrides({ discover: false })

        render(<TabBarStackNavigator />)

        expect(renderedTabs()).toEqual(['Home', 'Swap', 'Fund', 'Menu'])
    })

    it('removes the Swap tab when its capability is switched off while mounted', () => {
        render(<TabBarStackNavigator />)

        act(() => setCapabilityOverrides({ swap: false }))

        expect(renderedTabs()).toEqual(['Home', 'Discover', 'Fund', 'Menu'])
    })

    it('keeps the Fund tab when onramp is off, for its placeholder screen', () => {
        setCapabilityOverrides({ onramp: false })

        render(<TabBarStackNavigator />)

        expect(renderedTabs()).toContain('Fund')
    })
})
