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
import { Networks, getNetworkConfig } from '@perawallet/wallet-core-config'
import { useNodeOverrideStore } from '../../store'
import { resolveChainEndpoints } from '../algorandClient'

describe('resolveChainEndpoints', () => {
    beforeEach(() => {
        useNodeOverrideStore.getState().resetState()
    })

    test('uses the baked chain config when there is no override', () => {
        expect(resolveChainEndpoints(Networks.fnet)).toEqual({
            algodUrl: getNetworkConfig(Networks.fnet).algodUrl,
            indexerUrl: getNetworkConfig(Networks.fnet).indexerUrl,
            algodToken: getNetworkConfig(Networks.fnet).algodToken,
            indexerToken: getNetworkConfig(Networks.fnet).indexerToken,
        })
    })

    test('an override replaces only the fields it sets', () => {
        useNodeOverrideStore.getState().setOverride(Networks.localnet, {
            algodUrl: 'http://10.0.0.5:4001',
        })

        const resolved = resolveChainEndpoints(Networks.localnet)

        expect(resolved.algodUrl).toBe('http://10.0.0.5:4001')
        expect(resolved.indexerUrl).toBe(
            getNetworkConfig(Networks.localnet).indexerUrl,
        )
        expect(resolved.algodToken).toBe(
            getNetworkConfig(Networks.localnet).algodToken,
        )
    })
})
