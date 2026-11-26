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
import { useHoldingsRefreshStore } from '../holdingsRefresh'

const BASE: ChainScope = { chainId: 'base', networkId: 'mainnet' }

describe('useHoldingsRefreshStore', () => {
    beforeEach(() => {
        useHoldingsRefreshStore.getState().resetState()
    })

    it('keeps balance and collectible failures apart', () => {
        useHoldingsRefreshStore
            .getState()
            .setCollectiblesRefreshFailed(BASE, '0xA', true)

        const state = useHoldingsRefreshStore.getState()
        expect(state.collectiblesFailed['base/mainnet']?.['0xA']).toBe(true)
        expect(state.failed['base/mainnet']?.['0xA']).toBeUndefined()
    })

    it('keeps the state reference when a flag is set to what it already is', () => {
        const store = useHoldingsRefreshStore.getState()
        store.setCollectiblesRefreshFailed(BASE, '0xA', true)
        const before = useHoldingsRefreshStore.getState()

        store.setCollectiblesRefreshFailed(BASE, '0xA', true)
        store.setHoldingsRefreshFailed(BASE, '0xA', false)

        expect(useHoldingsRefreshStore.getState()).toBe(before)
    })

    it('clears both maps on reset', () => {
        const store = useHoldingsRefreshStore.getState()
        store.setHoldingsRefreshFailed(BASE, '0xA', true)
        store.setCollectiblesRefreshFailed(BASE, '0xA', true)

        store.resetState()

        expect(useHoldingsRefreshStore.getState()).toMatchObject({
            failed: {},
            collectiblesFailed: {},
        })
    })
})
