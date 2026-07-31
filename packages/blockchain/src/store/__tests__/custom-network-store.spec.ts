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
import {
    getCustomNetworkConfig,
    isCustomNetworkConfigured,
    useCustomNetworkStore,
    type CustomNetworkConfig,
} from '../custom-network-store'

const CONFIG: CustomNetworkConfig = {
    algodUrl: 'http://192.168.1.50:4001',
    algodToken: 'a'.repeat(64),
    indexerUrl: 'http://192.168.1.50:8980',
    genesisHash: 'MvoAmMBVQX32w2gqkfMKShsYCbYio8wyepw6Zk5CgOw=',
    genesisId: 'dockernet-v1',
}

describe('custom-network-store', () => {
    beforeEach(() => {
        useCustomNetworkStore.getState().resetState()
    })

    test('starts unconfigured', () => {
        expect(getCustomNetworkConfig()).toBeUndefined()
        expect(isCustomNetworkConfigured()).toBe(false)
    })

    test('stores the whole config as one unit', () => {
        useCustomNetworkStore.getState().setCustomNetwork(CONFIG)

        expect(getCustomNetworkConfig()).toEqual(CONFIG)
        expect(isCustomNetworkConfigured()).toBe(true)
    })

    test('saving replaces the previous config rather than merging', () => {
        const store = useCustomNetworkStore.getState()
        store.setCustomNetwork(CONFIG)
        store.setCustomNetwork({
            algodUrl: 'http://10.0.0.9:4001',
            indexerUrl: 'http://10.0.0.9:8980',
            genesisHash: 'other',
            genesisId: 'other-v1',
        })

        // The optional token from the first save must NOT survive — a custom
        // network is one coherent config, not a merge target.
        expect(getCustomNetworkConfig()?.algodToken).toBeUndefined()
        expect(getCustomNetworkConfig()?.algodUrl).toBe('http://10.0.0.9:4001')
    })

    test('clearCustomNetwork returns to unconfigured', () => {
        const store = useCustomNetworkStore.getState()
        store.setCustomNetwork(CONFIG)
        store.clearCustomNetwork()

        expect(getCustomNetworkConfig()).toBeUndefined()
        expect(isCustomNetworkConfigured()).toBe(false)
    })
})
