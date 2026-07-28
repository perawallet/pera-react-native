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
import { Networks } from '@perawallet/wallet-core-config'
import {
    getNodeEndpointOverride,
    useNodeOverrideStore,
} from '../node-override-store'

describe('node-override-store', () => {
    beforeEach(() => {
        useNodeOverrideStore.getState().resetState()
    })

    test('starts with no overrides', () => {
        expect(useNodeOverrideStore.getState().overrides).toEqual({})
        expect(getNodeEndpointOverride(Networks.localnet)).toBeUndefined()
    })

    test('stores an override per network without touching the others', () => {
        useNodeOverrideStore.getState().setOverride(Networks.localnet, {
            algodUrl: 'http://192.168.1.20:4001',
        })

        expect(getNodeEndpointOverride(Networks.localnet)).toEqual({
            algodUrl: 'http://192.168.1.20:4001',
        })
        expect(getNodeEndpointOverride(Networks.fnet)).toBeUndefined()
    })

    test('merges partial updates into an existing override', () => {
        const store = useNodeOverrideStore.getState()
        store.setOverride(Networks.fnet, { algodUrl: 'http://a' })
        store.setOverride(Networks.fnet, { indexerUrl: 'http://b' })

        expect(getNodeEndpointOverride(Networks.fnet)).toEqual({
            algodUrl: 'http://a',
            indexerUrl: 'http://b',
        })
    })

    test('clearOverride removes only that network', () => {
        const store = useNodeOverrideStore.getState()
        store.setOverride(Networks.fnet, { algodUrl: 'http://a' })
        store.setOverride(Networks.betanet, { algodUrl: 'http://b' })
        store.clearOverride(Networks.fnet)

        expect(getNodeEndpointOverride(Networks.fnet)).toBeUndefined()
        expect(getNodeEndpointOverride(Networks.betanet)).toEqual({
            algodUrl: 'http://b',
        })
    })
})
