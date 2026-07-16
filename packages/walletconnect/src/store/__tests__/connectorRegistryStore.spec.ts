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

import { describe, test, expect, beforeEach } from 'vitest'
import type WalletConnect from '@perawallet/walletconnect'
import { useConnectorRegistryStore } from '../connectorRegistryStore'

const fakeConnector = (clientId: string): WalletConnect =>
    ({ clientId }) as unknown as WalletConnect

describe('useConnectorRegistryStore', () => {
    beforeEach(() => {
        useConnectorRegistryStore.getState().resetState()
    })

    test('registerConnector adds the connector and clears any tombstone', () => {
        useConnectorRegistryStore.getState().forgetConnector('c-1') // sets tombstone
        useConnectorRegistryStore
            .getState()
            .registerConnector('c-1', fakeConnector('c-1'))

        const state = useConnectorRegistryStore.getState()
        expect(state.connectors['c-1']).toBeDefined()
        expect(state.tombstones.has('c-1')).toBe(false)
    })

    test('forgetConnector drops the connector and adds a tombstone', () => {
        useConnectorRegistryStore
            .getState()
            .registerConnector('c-1', fakeConnector('c-1'))
        useConnectorRegistryStore.getState().forgetConnector('c-1')

        const state = useConnectorRegistryStore.getState()
        expect(state.connectors['c-1']).toBeUndefined()
        expect(state.tombstones.has('c-1')).toBe(true)
    })

    test('resetState clears connectors and tombstones', () => {
        useConnectorRegistryStore
            .getState()
            .registerConnector('c-1', fakeConnector('c-1'))
        useConnectorRegistryStore.getState().forgetConnector('c-2')
        useConnectorRegistryStore.getState().resetState()

        const state = useConnectorRegistryStore.getState()
        expect(state.connectors).toEqual({})
        expect(state.tombstones.size).toBe(0)
    })
})
