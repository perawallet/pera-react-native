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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useHeldListedTokensStore } from '../heldListedTokens'
import { assetIdsIn } from '../tokenSets'

const ETH: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const BASE: ChainScope = { chainId: 'base', networkId: 'mainnet' }
const ADDRESS = '0xabc'

const state = () => useHeldListedTokensStore.getState()

beforeEach(() => {
    state().resetState()
})

describe('addHeldListedTokens', () => {
    it('merges ids sorted under one address and scope only', () => {
        state().addHeldListedTokens({
            address: ADDRESS,
            scope: ETH,
            assetIds: ['0xb', '0xa'],
        })
        state().addHeldListedTokens({
            address: ADDRESS,
            scope: ETH,
            assetIds: ['0xc', '0xa'],
        })

        expect(assetIdsIn(state().heldListedTokens, ADDRESS, ETH)).toEqual([
            '0xa',
            '0xb',
            '0xc',
        ])
        expect(assetIdsIn(state().heldListedTokens, ADDRESS, BASE)).toEqual([])
    })

    it('keeps the state reference when nothing is new', () => {
        state().addHeldListedTokens({
            address: ADDRESS,
            scope: ETH,
            assetIds: ['0xa'],
        })
        const before = state()

        state().addHeldListedTokens({
            address: ADDRESS,
            scope: ETH,
            assetIds: ['0xa'],
        })

        expect(state()).toBe(before)
    })

    it('does not write storage for ids it already holds', () => {
        state().addHeldListedTokens({
            address: ADDRESS,
            scope: ETH,
            assetIds: ['0xa'],
        })
        const write = vi.spyOn(getProvider().keyValueStorage, 'setItem')

        state().addHeldListedTokens({
            address: ADDRESS,
            scope: ETH,
            assetIds: ['0xa'],
        })

        expect(write).not.toHaveBeenCalled()

        state().addHeldListedTokens({
            address: ADDRESS,
            scope: ETH,
            assetIds: ['0xb'],
        })

        expect(write).toHaveBeenCalledTimes(1)
        write.mockRestore()
    })

    it('has no action that removes an id', () => {
        expect(Object.keys(state()).sort()).toEqual([
            'addHeldListedTokens',
            'heldListedTokens',
            'resetState',
        ])
    })

    it('resetState clears every id', () => {
        state().addHeldListedTokens({
            address: ADDRESS,
            scope: ETH,
            assetIds: ['0xa'],
        })

        state().resetState()

        expect(state().heldListedTokens).toEqual({})
    })
})
