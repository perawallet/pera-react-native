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
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Stands in for the navigator factory so rendering records the registered
// screens instead of mounting real ones. Screens must be registered
// declaratively, so this captures exactly what the navigator would hand
// React Navigation.
const { registered, mockIsPeraCardEnabled } = vi.hoisted(() => ({
    registered: [] as { name: string }[],
    mockIsPeraCardEnabled: vi.fn(() => true),
}))

vi.mock('@routes/createAppStackNavigator', () => ({
    createAppStackNavigator: () => ({
        Navigator: ({ children }: { children: React.ReactNode }) => (
            <>{children}</>
        ),
        Screen: (props: { name: string }) => {
            registered.push(props)
            return null
        },
    }),
}))
vi.mock('@hooks/useIsPeraCardEnabled', () => ({
    useIsPeraCardEnabled: mockIsPeraCardEnabled,
}))
vi.mock('@modules/accounts/screens/AccountScreen', () => ({
    AccountScreen: () => null,
}))
vi.mock('@modules/assets/screens/AssetDetailsScreen', () => ({
    AssetDetailsScreen: () => null,
}))
vi.mock('@modules/assets/screens/CollectibleDetailScreen', () => ({
    CollectibleDetailScreen: () => null,
}))
vi.mock('@modules/accounts/screens/RemoveAssetsScreen', () => ({
    RemoveAssetsScreen: () => null,
}))
vi.mock('@components/NavigationHeader', () => ({
    NavigationHeader: () => null,
}))
vi.mock('@routes/listeners', () => ({ screenListeners: {} }))
vi.mock('@layouts/index', () => ({ fullScreenLayout: () => null }))

import { AccountStackNavigator } from '../index'

const registeredNames = (): string[] => {
    registered.length = 0
    render(<AccountStackNavigator />)
    return registered.map(screen => screen.name)
}

describe('AccountStackNavigator', () => {
    beforeEach(() => {
        mockIsPeraCardEnabled.mockReturnValue(true)
    })

    // The Home tab renders this stack, so a screen registered here is a screen
    // that keeps the bottom tab bar. Moving the card dashboard back out to the
    // root stack would silently strip the tab bar off it.
    it('hosts the Pera Card dashboard and its transaction screens so they keep the bottom tab bar', () => {
        expect(registeredNames()).toEqual(
            expect.arrayContaining([
                'PeraCardAccount',
                'CardTransactions',
                'CardTransactionDetail',
            ]),
        )
    })

    it('keeps the wallet account home as the first route so back from the card lands there', () => {
        expect(registeredNames()[0]).toBe('AccountDetails')
    })

    it('drops the card screens when the Pera Card flag is off', () => {
        mockIsPeraCardEnabled.mockReturnValue(false)

        const names = registeredNames()

        expect(names).toContain('AccountDetails')
        expect(names).not.toContain('PeraCardAccount')
        expect(names).not.toContain('CardTransactions')
        expect(names).not.toContain('CardTransactionDetail')
    })
})
