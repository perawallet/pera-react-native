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

import { describe, it, expect, beforeEach } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { hiddenAssetIdsOf, useHiddenTokensStore } from '../hiddenTokens'

const ETH: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const BASE: ChainScope = { chainId: 'ethereum', networkId: 'base' }
const ADDRESS = '0xabc'

const state = () => useHiddenTokensStore.getState()

beforeEach(() => {
    state().resetState()
})

describe('setTokenHidden', () => {
    it('keeps each address list sorted and ignores a repeated hide', () => {
        state().setTokenHidden({
            address: ADDRESS,
            scope: ETH,
            assetId: '0xb',
            isHidden: true,
        })
        state().setTokenHidden({
            address: ADDRESS,
            scope: ETH,
            assetId: '0xa',
            isHidden: true,
        })
        state().setTokenHidden({
            address: ADDRESS,
            scope: ETH,
            assetId: '0xa',
            isHidden: true,
        })

        expect(hiddenAssetIdsOf(state().hiddenTokens, ADDRESS, ETH)).toEqual([
            '0xa',
            '0xb',
        ])
    })

    it('drops the address, then the scope, once the last id is unhidden', () => {
        state().setTokenHidden({
            address: ADDRESS,
            scope: ETH,
            assetId: '0xa',
            isHidden: true,
        })

        state().setTokenHidden({
            address: ADDRESS,
            scope: ETH,
            assetId: '0xa',
            isHidden: false,
        })

        expect(state().hiddenTokens).toEqual({})
    })

    it('hides on one scope only', () => {
        state().setTokenHidden({
            address: ADDRESS,
            scope: ETH,
            assetId: '0xa',
            isHidden: true,
        })

        expect(hiddenAssetIdsOf(state().hiddenTokens, ADDRESS, BASE)).toEqual(
            [],
        )
    })

    it('leaves the state reference alone when nothing changes', () => {
        const before = state().hiddenTokens

        state().setTokenHidden({
            address: ADDRESS,
            scope: ETH,
            assetId: '0xa',
            isHidden: false,
        })

        expect(state().hiddenTokens).toBe(before)
    })
})

describe('replaceHiddenTokens', () => {
    it('replaces the whole map', () => {
        state().setTokenHidden({
            address: ADDRESS,
            scope: ETH,
            assetId: '0xa',
            isHidden: true,
        })

        state().replaceHiddenTokens({ 'ethereum/base': { '0xdef': ['0x1'] } })

        expect(state().hiddenTokens).toEqual({
            'ethereum/base': { '0xdef': ['0x1'] },
        })
    })
})

describe('hiddenAssetIdsOf', () => {
    it('is empty for an address that hid nothing', () => {
        expect(hiddenAssetIdsOf({}, ADDRESS, ETH)).toEqual([])
    })
})
