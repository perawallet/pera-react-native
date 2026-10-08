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
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'

const { registered } = vi.hoisted(() => ({
    registered: [] as { name: string }[],
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
vi.mock('@modules/transactions/routes', () => ({
    AssetTransferRequestsScreen: () => null,
    AssetClaimDetailScreen: () => null,
    TransactionSuccessScreen: () => null,
    ClaimProcessingScreen: () => null,
}))
vi.mock('../../screens/MessagesScreen', () => ({ MessagesScreen: () => null }))
vi.mock('../../screens/MultisigInvitationNameScreen', () => ({
    MultisigInvitationNameScreen: () => null,
}))
vi.mock('@components/NavigationHeader', () => ({
    NavigationHeader: () => null,
}))
vi.mock('@routes/listeners', () => ({ screenListeners: {} }))
vi.mock('@layouts/index', () => ({
    fullScreenLayout: () => null,
    safeAreaLayout: () => null,
}))

import { MessagesStackNavigator } from '../MessagesRoutes'

const registeredNames = (): string[] => {
    registered.length = 0
    render(<MessagesStackNavigator />)
    return registered.map(screen => screen.name)
}

describe('MessagesStackNavigator', () => {
    beforeEach(() => {
        useRemoteConfigStore.getState().resetState()
    })

    it('registers the asset inbox screens at the Algorand defaults', () => {
        expect(registeredNames()).toEqual(
            expect.arrayContaining([
                'MessagesHome',
                'AssetTransferRequests',
                'AssetClaimDetail',
                'ClaimProcessing',
                'ClaimSuccess',
            ]),
        )
    })

    it('drops the asset inbox screens, and only those, when assetInbox is off', () => {
        setCapabilityOverrides({ assetInbox: false })

        const names = registeredNames()

        expect(names).toEqual(['MessagesHome', 'MultisigInvitationName'])
    })
})
