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
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    isAutoHiddenHolding,
    keptAssetIdsOf,
    useKeptTokensStore,
} from '../keptTokens'
import {
    FAKE_CHAIN_ID,
    registerFakeNativeAsset,
} from '../../__tests__/fakeAccountsChain'

const ETH: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const BASE: ChainScope = { chainId: 'base', networkId: 'mainnet' }
const ADDRESS = '0xabc'
const FAKE_SCOPE: ChainScope = { chainId: FAKE_CHAIN_ID, networkId: 'mainnet' }

const state = () => useKeptTokensStore.getState()

beforeEach(() => {
    state().resetState()
})

describe('setTokenKept', () => {
    it('keeps and releases a token on one scope', () => {
        state().setTokenKept({
            address: ADDRESS,
            scope: ETH,
            assetId: '0xa',
            isKept: true,
        })

        expect(keptAssetIdsOf(state().keptTokens, ADDRESS, ETH)).toEqual([
            '0xa',
        ])
        expect(keptAssetIdsOf(state().keptTokens, ADDRESS, BASE)).toEqual([])

        state().setTokenKept({
            address: ADDRESS,
            scope: ETH,
            assetId: '0xa',
            isKept: false,
        })

        expect(state().keptTokens).toEqual({})
    })

    it('leaves another scope its own reference', () => {
        state().setTokenKept({
            address: ADDRESS,
            scope: BASE,
            assetId: '0xb',
            isKept: true,
        })
        const base = state().keptTokens[toScopeKey(BASE)]

        state().setTokenKept({
            address: ADDRESS,
            scope: ETH,
            assetId: '0xa',
            isKept: true,
        })

        expect(state().keptTokens[toScopeKey(BASE)]).toBe(base)
    })
})

describe('keepTokens', () => {
    it('keeps a batch in one write, sorted and without repeats', () => {
        let writes = 0
        const unsubscribe = useKeptTokensStore.subscribe(() => {
            writes += 1
        })

        state().keepTokens({
            address: ADDRESS,
            scope: ETH,
            assetIds: ['0xc', '0xa', '0xc'],
        })
        unsubscribe()

        expect(writes).toBe(1)
        expect(keptAssetIdsOf(state().keptTokens, ADDRESS, ETH)).toEqual([
            '0xa',
            '0xc',
        ])
    })

    it('writes nothing when every token is already kept', () => {
        state().keepTokens({ address: ADDRESS, scope: ETH, assetIds: ['0xa'] })
        const before = state().keptTokens

        state().keepTokens({ address: ADDRESS, scope: ETH, assetIds: ['0xa'] })

        expect(state().keptTokens).toBe(before)
    })
})

describe('mergeKeptTokens', () => {
    it('adds another device’s keeps to this one’s instead of replacing them', () => {
        state().keepTokens({ address: ADDRESS, scope: ETH, assetIds: ['0xa'] })

        state().mergeKeptTokens({ [toScopeKey(ETH)]: { [ADDRESS]: ['0xb'] } })

        expect(keptAssetIdsOf(state().keptTokens, ADDRESS, ETH)).toEqual([
            '0xa',
            '0xb',
        ])
    })

    it('writes nothing when the merge adds nothing', () => {
        state().keepTokens({ address: ADDRESS, scope: ETH, assetIds: ['0xa'] })
        let writes = 0
        const unsubscribe = useKeptTokensStore.subscribe(() => {
            writes += 1
        })

        state().mergeKeptTokens({ [toScopeKey(ETH)]: { [ADDRESS]: ['0xa'] } })
        unsubscribe()

        expect(writes).toBe(0)
    })
})

describe('replaceKeptTokens', () => {
    it('replaces the whole map', () => {
        state().keepTokens({ address: ADDRESS, scope: ETH, assetIds: ['0xa'] })

        state().replaceKeptTokens({
            [toScopeKey(BASE)]: { [ADDRESS]: ['0xb'] },
        })

        expect(keptAssetIdsOf(state().keptTokens, ADDRESS, ETH)).toEqual([])
        expect(keptAssetIdsOf(state().keptTokens, ADDRESS, BASE)).toEqual([
            '0xb',
        ])
    })
})

describe('isAutoHiddenHolding', () => {
    const TOKEN = '777'
    const holding = (verificationTier?: 'suspicious' | 'unverified') => ({
        address: ADDRESS,
        scope: FAKE_SCOPE,
        assetId: TOKEN,
        asset: verificationTier
            ? { peraMetadata: { verificationTier } }
            : undefined,
    })

    it('hides a suspicious token nobody kept', () => {
        registerFakeNativeAsset(6)

        expect(isAutoHiddenHolding(holding('suspicious'), {})).toBe(true)
    })

    it('lists a suspicious token its address kept', () => {
        registerFakeNativeAsset(6)
        state().keepTokens({
            address: ADDRESS,
            scope: FAKE_SCOPE,
            assetIds: [TOKEN],
        })

        expect(
            isAutoHiddenHolding(holding('suspicious'), state().keptTokens),
        ).toBe(false)
    })

    it('lists an unverified token and one with no metadata yet', () => {
        registerFakeNativeAsset(6)

        expect(isAutoHiddenHolding(holding('unverified'), {})).toBe(false)
        expect(isAutoHiddenHolding(holding(), {})).toBe(false)
    })

    it('never hides on a chain where the user opts in to each asset', () => {
        registerFakeNativeAsset(6, { requiresAssetOptIn: true })

        expect(isAutoHiddenHolding(holding('suspicious'), {})).toBe(false)
    })
})
