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

import { afterEach, describe, expect, it } from 'vitest'
import {
    CUSTOM_NETWORK_ID,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import { config } from '@perawallet/wallet-core-config'
import { algorandNodeEndpoint } from '../node-endpoint'
import '../store/custom-network'

describe('algorandNodeEndpoint', () => {
    afterEach(() => {
        useNetworkStore.getState().resetState()
    })

    it('reports the configured algod URL for a network', () => {
        expect(algorandNodeEndpoint.endpointUrl('testnet')).toBe(
            config.testnetAlgodUrl,
        )
    })

    it('reports nothing for a custom network that was never saved', () => {
        expect(
            algorandNodeEndpoint.endpointUrl(CUSTOM_NETWORK_ID),
        ).toBeUndefined()
    })

    it('reports the saved custom node', () => {
        useNetworkStore.getState().setCustomNetwork(LEGACY_CHAIN_ID, {
            id: CUSTOM_NETWORK_ID,
            algodUrl: 'http://192.168.1.50:4001',
            indexerUrl: 'http://192.168.1.50:8980',
            genesisHash: 'hash',
            genesisId: 'dockernet-v1',
        })

        expect(algorandNodeEndpoint.endpointUrl(CUSTOM_NETWORK_ID)).toBe(
            'http://192.168.1.50:4001',
        )
    })

    it('reports nothing for a network config does not carry', () => {
        expect(algorandNodeEndpoint.endpointUrl('devnet')).toBeUndefined()
    })

    it('offers no override', () => {
        expect(algorandNodeEndpoint.checkOverride).toBeUndefined()
    })
})
