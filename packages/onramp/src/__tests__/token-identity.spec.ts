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

import { beforeEach, describe, expect, it } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'

import { rampChainAdapters } from '../chain-adapter'
import { rampTokenAsset } from '../token-identity'
import { registerFakeChain } from './fakeChains'
import { registerFakeRampAdapter } from './fakeRampAdapter'

const MAINNET: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

describe('rampTokenAsset', () => {
    beforeEach(() => {
        getProvider().chains.reset()
        registerFakeChain({
            chainId: 'algorand',
            caip2: 'fake:a',
            nativeAssetId: '0',
        })
        registerFakeRampAdapter()
    })

    it("marks the chain's native asset", () => {
        expect(rampTokenAsset({ id: 'fake:a/asset:0' }, MAINNET)).toEqual({
            chainId: 'algorand',
            assetId: '0',
            isNative: true,
        })
    })

    it('maps a non-native asset to its own id', () => {
        expect(rampTokenAsset({ id: 'fake:a/asset:42' }, MAINNET)).toEqual({
            chainId: 'algorand',
            assetId: '42',
            isNative: false,
        })
    })

    it('takes nativeness from the chain descriptor, not the id', () => {
        getProvider().chains.reset()
        registerFakeChain({
            chainId: 'algorand',
            caip2: 'fake:a',
            nativeAssetId: '42',
        })

        expect(
            rampTokenAsset({ id: 'fake:a/asset:42' }, MAINNET)?.isNative,
        ).toBe(true)
        expect(
            rampTokenAsset({ id: 'fake:a/asset:0' }, MAINNET)?.isNative,
        ).toBe(false)
    })

    it("is null for another chain's asset", () => {
        expect(rampTokenAsset({ id: 'fake:b/token:7' }, MAINNET)).toBeNull()
    })

    it('is null for fiat, which no chain adapter reads', () => {
        expect(
            rampTokenAsset({ id: 'swift:0/iso4217:EUR' }, MAINNET),
        ).toBeNull()
    })

    it('is null for a chain with no ramp adapter', () => {
        rampChainAdapters.reset()

        expect(rampTokenAsset({ id: 'fake:a/asset:0' }, MAINNET)).toBeNull()
    })
})
