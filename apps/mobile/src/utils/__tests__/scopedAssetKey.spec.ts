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

import { describe, expect, it } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { scopedAssetKey } from '../scopedAssetKey'

const ETH_MAINNET = { chainId: 'ethereum', networkId: 'mainnet' } as ChainScope
const ETH_SEPOLIA = { chainId: 'ethereum', networkId: 'sepolia' } as ChainScope
const BASE_MAINNET = { chainId: 'base', networkId: 'mainnet' } as ChainScope

describe('scopedAssetKey', () => {
    it('tells apart one asset id on different chains and networks', () => {
        const keys = [ETH_MAINNET, ETH_SEPOLIA, BASE_MAINNET].map(scope =>
            scopedAssetKey(scope, 'native'),
        )

        expect(new Set(keys).size).toBe(3)
    })

    it('gives the same key for the same asset on the same network', () => {
        expect(scopedAssetKey(ETH_MAINNET, 'native')).toBe(
            scopedAssetKey({ ...ETH_MAINNET }, 'native'),
        )
    })
})
