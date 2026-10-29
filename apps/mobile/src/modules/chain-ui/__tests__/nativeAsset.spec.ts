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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
    CHAIN_IDS,
    isEvmChainId,
    type AssetRef,
} from '@perawallet/wallet-core-chain-contract'
import AlgoAssetIcon from '@assets/icons/assets/algo.svg'
import AvalancheIcon from '@assets/icons/chains/avalanche.svg'
import BscIcon from '@assets/icons/chains/bsc.svg'
import EthereumIcon from '@assets/icons/chains/ethereum.svg'
import PolygonIcon from '@assets/icons/chains/polygon.svg'
import {
    registerEvmChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import {
    nativeAssetGlyphOf,
    nativeAssetIconOf,
    nativeAssetInfoOf,
} from '../nativeAsset'

const EVM_CHAIN_IDS = CHAIN_IDS.filter(isEvmChainId)

const native = (chainId: AssetRef['chainId']): AssetRef => ({
    chainId,
    assetId: 'native',
})

describe('native asset art', () => {
    beforeEach(() => {
        EVM_CHAIN_IDS.forEach(registerEvmChain)
    })

    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    it('gives the native coin of every EVM chain an icon', () => {
        for (const chainId of EVM_CHAIN_IDS) {
            expect(nativeAssetIconOf(native(chainId))).toBeDefined()
        }
    })

    it('draws the ETH coin on the chains that pay gas in ETH and their own coin elsewhere', () => {
        expect(nativeAssetIconOf(native('ethereum'))).toBe(EthereumIcon)
        expect(nativeAssetIconOf(native('base'))).toBe(EthereumIcon)
        expect(nativeAssetIconOf(native('arbitrum'))).toBe(EthereumIcon)
        expect(nativeAssetIconOf(native('bsc'))).toBe(BscIcon)
        expect(nativeAssetIconOf(native('avalanche'))).toBe(AvalancheIcon)
        expect(nativeAssetIconOf(native('polygon'))).toBe(PolygonIcon)
    })

    it('resolves ALGO to its icon, glyph and name', () => {
        const algo: AssetRef = { chainId: 'algorand', assetId: '0' }

        expect(nativeAssetIconOf(algo)).toBe(AlgoAssetIcon)
        expect(nativeAssetGlyphOf(algo)).toEqual({ glyph: '¦', label: 'Algo' })
        expect(nativeAssetInfoOf(algo)?.name).toBe('Algo')
    })

    it('gives ETH native no font glyph', () => {
        expect(nativeAssetGlyphOf(native('ethereum'))).toBeUndefined()
        expect(nativeAssetInfoOf(native('ethereum'))?.name).toBe('Ether')
    })

    it("does not take Algorand's native id for native on an EVM chain", () => {
        const ref: AssetRef = { chainId: 'ethereum', assetId: '0' }

        expect(nativeAssetInfoOf(ref)).toBeUndefined()
        expect(nativeAssetIconOf(ref)).toBeUndefined()
        expect(nativeAssetGlyphOf(ref)).toBeUndefined()
    })

    it('treats a token as not native', () => {
        const ref: AssetRef = {
            chainId: 'ethereum',
            assetId: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        }

        expect(nativeAssetInfoOf(ref)).toBeUndefined()
        expect(nativeAssetIconOf(ref)).toBeUndefined()
        expect(nativeAssetGlyphOf(ref)).toBeUndefined()
    })

    it('treats a chain this build does not register as a token without throwing', () => {
        restoreAlgorandOnlyChains()

        expect(nativeAssetInfoOf(native('base'))).toBeUndefined()
        expect(nativeAssetIconOf(native('base'))).toBeUndefined()
        expect(nativeAssetGlyphOf(native('base'))).toBeUndefined()
    })
})
