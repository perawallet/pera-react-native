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
import { act, renderHook } from '@testing-library/react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useSendChainSelectionScreen } from '../useSendChainSelectionScreen'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    setSelectedAsset: vi.fn(),
    setChainId: vi.fn(),
    selection: vi.fn(),
}))

const account = { id: 'two-chains' }

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mocks.navigate }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => account,
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: () => ({
        setSelectedAsset: mocks.setSelectedAsset,
        setChainId: mocks.setChainId,
    }),
}))

vi.mock('../../../../hooks/chain-selection/useAccountChainSelection', () => ({
    useAccountChainSelection: (params: unknown) => {
        mocks.selection(params)
        return {
            rows: [],
            enablingChainId: undefined,
            handleSelectChain: vi.fn(),
            handleAddChain: vi.fn(),
        }
    },
}))

type SelectionParams = {
    onSelectChain: (chainId: ChainId) => void
    onChainEnabled?: unknown
}

const lastParams = (): SelectionParams =>
    mocks.selection.mock.lastCall?.[0] as SelectionParams

describe('useSendChainSelectionScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("offers the selected account's sendable chains", () => {
        renderHook(() => useSendChainSelectionScreen())

        expect(mocks.selection).toHaveBeenCalledWith(
            expect.objectContaining({ account, capability: 'send' }),
        )
        // The accounts store hands back the account once it holds the added chain.
        expect(lastParams().onChainEnabled).toBeUndefined()
    })

    it('picks the network and opens its asset picker, dropping an asset chosen on another network', () => {
        renderHook(() => useSendChainSelectionScreen())

        act(() => lastParams().onSelectChain('ethereum' as ChainId))

        expect(mocks.setSelectedAsset).toHaveBeenCalledWith(undefined)
        expect(mocks.setChainId).toHaveBeenCalledWith('ethereum')
        expect(mocks.navigate).toHaveBeenCalledWith('AssetSelection')
    })
})
