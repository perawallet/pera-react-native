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
import { toScopeKey } from '@perawallet/wallet-core-chain-contract'
import { useAssetSearchAvailabilityStore } from '../search-availability-store'

const BASE_MAINNET = { chainId: 'base', networkId: 'mainnet' } as const
const BASE_SEPOLIA = { chainId: 'base', networkId: 'sepolia' } as const

describe('useAssetSearchAvailabilityStore', () => {
    beforeEach(() => {
        useAssetSearchAvailabilityStore.getState().resetState()
    })

    it('records the reason under the scope key', () => {
        const reason = new Error('chain_not_enabled')

        useAssetSearchAvailabilityStore
            .getState()
            .markSearchUnavailable(BASE_MAINNET, reason)

        expect(
            useAssetSearchAvailabilityStore.getState().unavailableSearches[
                toScopeKey(BASE_MAINNET)
            ],
        ).toBe(reason)
    })

    it('keeps the state reference when the scope is already known', () => {
        const { markSearchUnavailable } =
            useAssetSearchAvailabilityStore.getState()
        markSearchUnavailable(BASE_MAINNET, new Error('first'))
        const before = useAssetSearchAvailabilityStore.getState()

        markSearchUnavailable(BASE_MAINNET, new Error('second'))

        expect(useAssetSearchAvailabilityStore.getState()).toBe(before)
    })

    it('keeps the networks of one chain apart', () => {
        useAssetSearchAvailabilityStore
            .getState()
            .markSearchUnavailable(BASE_MAINNET, new Error('refused'))

        expect(
            useAssetSearchAvailabilityStore.getState().unavailableSearches[
                toScopeKey(BASE_SEPOLIA)
            ],
        ).toBeUndefined()
    })

    it('clears on reset', () => {
        useAssetSearchAvailabilityStore
            .getState()
            .markSearchUnavailable(BASE_MAINNET, new Error('refused'))

        useAssetSearchAvailabilityStore.getState().resetState()

        expect(
            useAssetSearchAvailabilityStore.getState().unavailableSearches,
        ).toEqual({})
    })
})
