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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FundingType } from '@perawallet/wallet-core-card'

const mocks = vi.hoisted(() => ({
    query: { isEnabled: undefined as boolean | undefined, updatedAt: 0 },
    store: {
        selectedFundingType: null as string | null,
        setSelectedFundingType: vi.fn(),
    },
}))

vi.mock('@perawallet/wallet-core-card', async () => ({
    ...(await vi.importActual<object>('@perawallet/wallet-core-card')),
    useCardAutoDrawEnabledQuery: () => mocks.query,
    getCardFundingType: () => mocks.store.selectedFundingType,
    setCardFundingType: mocks.store.setSelectedFundingType,
}))
vi.mock('../useCardScope', () => ({
    useCardScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
}))

import { useSyncCardFundingTypeFromChain } from '../useSyncCardFundingTypeFromChain'

describe('useSyncCardFundingTypeFromChain', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.query = { isEnabled: undefined, updatedAt: 0 }
        mocks.store.selectedFundingType = null
    })

    it('records Auto when the switch is on chain but this device has no or another record', () => {
        mocks.query = { isEnabled: true, updatedAt: 1 }
        mocks.store.selectedFundingType = FundingType.Manual

        renderHook(() => useSyncCardFundingTypeFromChain())

        expect(mocks.store.setSelectedFundingType).toHaveBeenCalledWith(
            FundingType.Auto,
        )
    })

    it('records Manual when the switch is off on chain', () => {
        mocks.query = { isEnabled: false, updatedAt: 1 }
        mocks.store.selectedFundingType = FundingType.Auto

        renderHook(() => useSyncCardFundingTypeFromChain())

        expect(mocks.store.setSelectedFundingType).toHaveBeenCalledWith(
            FundingType.Manual,
        )
    })

    it('leaves a matching record alone', () => {
        mocks.query = { isEnabled: true, updatedAt: 1 }
        mocks.store.selectedFundingType = FundingType.Auto

        renderHook(() => useSyncCardFundingTypeFromChain())

        expect(mocks.store.setSelectedFundingType).not.toHaveBeenCalled()
    })

    it('changes nothing until the chain has answered', () => {
        mocks.store.selectedFundingType = FundingType.Auto

        renderHook(() => useSyncCardFundingTypeFromChain())

        expect(mocks.store.setSelectedFundingType).not.toHaveBeenCalled()
    })

    it('does not re-apply a cached answer when only the record changes', () => {
        mocks.query = { isEnabled: false, updatedAt: 1 }
        mocks.store.selectedFundingType = FundingType.Manual
        const { rerender } = renderHook(() => useSyncCardFundingTypeFromChain())

        mocks.store.selectedFundingType = FundingType.Auto
        rerender()

        expect(mocks.store.setSelectedFundingType).not.toHaveBeenCalled()
    })
})
