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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { Networks, getNetworkConfig } from '@perawallet/wallet-core-config'
import { useCustomNetworkStore } from '../../store'
import { getExpectedGenesisHash } from '../resolveGenesisHash'

describe('getExpectedGenesisHash', () => {
    beforeEach(() => {
        useCustomNetworkStore.getState().resetState()
        vi.restoreAllMocks()
    })

    test.each([Networks.mainnet, Networks.testnet, Networks.betanet])(
        'returns the build-time-pinned hash for %s without any network access',
        network => {
            const fetchSpy = vi
                .spyOn(globalThis, 'fetch')
                .mockRejectedValue(new Error('no network in unit tests'))

            expect(getExpectedGenesisHash(network)).toBe(
                getNetworkConfig(network).genesisHash,
            )
            expect(fetchSpy).not.toHaveBeenCalled()
        },
    )

    test('returns the stored hash for custom, without any network access', () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockRejectedValue(new Error('no network in unit tests'))
        useCustomNetworkStore.getState().setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            genesisHash: 'MvoAmMBVQX32w2gqkfMKShsYCbYio8wyepw6Zk5CgOw=',
            genesisId: 'dockernet-v1',
        })

        expect(getExpectedGenesisHash(Networks.custom)).toBe(
            'MvoAmMBVQX32w2gqkfMKShsYCbYio8wyepw6Zk5CgOw=',
        )
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    test('returns empty string for an unconfigured custom slot', () => {
        expect(getExpectedGenesisHash(Networks.custom)).toBe('')
    })
})
