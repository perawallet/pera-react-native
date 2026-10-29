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
import { renderHook } from '@testing-library/react'
import { useSendFundsRoutes } from '../useSendFundsRoutes'

const state = vi.hoisted(() => ({
    send: {} as {
        canSelectAsset: boolean
        selectedAssetId?: string
        chainId?: string
    },
    account: { id: 'a' } as { id: string } | undefined,
    options: [] as { chainId: string; isEnabled: boolean }[],
    isCollectible: false,
    setChainId: vi.fn(),
    resolverCapability: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => state.account,
    useAccountChainOptionsResolver: (capability: string) => {
        state.resolverCapability(capability)
        return () => state.options
    },
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: (_scope: unknown, ids: string[]) => ({
        data: new Map(ids.map(id => [id, { assetId: id }])),
    }),
    isUniqueCollectible: () => state.isCollectible,
}))

vi.mock('@modules/transactions/hooks', async () => ({
    useSendFunds: () => ({ ...state.send, setChainId: state.setChainId }),
    useSendScope: () => ({ chainId: 'algorand', networkId: 'mainnet' }),
    needsChainSelection: (
        await vi.importActual<
            typeof import('../../../hooks/chain-selection/needsChainSelection')
        >('../../../hooks/chain-selection/needsChainSelection')
    ).needsChainSelection,
}))

const initialRoute = () =>
    renderHook(() => useSendFundsRoutes()).result.current.initialRouteName

describe('useSendFundsRoutes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        state.send = { canSelectAsset: true }
        state.account = { id: 'a' }
        state.options = [
            { chainId: 'algorand', isEnabled: true },
            { chainId: 'ethereum', isEnabled: true },
        ]
        state.isCollectible = false
    })

    it('asks for the network first when the account can send on more than one', () => {
        expect(initialRoute()).toBe('ChainSelection')
        expect(state.resolverCapability).toHaveBeenCalledWith('send')
        expect(state.setChainId).not.toHaveBeenCalled()
    })

    it('keeps Choose Network as the first screen once a network is picked', () => {
        const { result, rerender } = renderHook(() => useSendFundsRoutes())

        state.send = { canSelectAsset: true, chainId: 'ethereum' }
        rerender()

        expect(result.current.initialRouteName).toBe('ChainSelection')
    })

    it('asks for the network first when the only one still has to be added', () => {
        state.options = [{ chainId: 'base', isEnabled: false }]

        expect(initialRoute()).toBe('ChainSelection')
    })

    it("opens the asset picker on an account's only network, and pins it", () => {
        state.options = [{ chainId: 'ethereum', isEnabled: true }]

        expect(initialRoute()).toBe('AssetSelection')
        expect(state.setChainId).toHaveBeenCalledWith('ethereum')
    })

    it('opens the asset picker on a network an entry point pinned', () => {
        state.send = { canSelectAsset: true, chainId: 'ethereum' }

        expect(initialRoute()).toBe('AssetSelection')
        expect(state.setChainId).not.toHaveBeenCalled()
    })

    it('opens the asset picker when the account offers no network to choose', () => {
        state.options = []

        expect(initialRoute()).toBe('AssetSelection')
    })

    it('skips both pickers for a prefilled asset', () => {
        state.send = { canSelectAsset: false, selectedAssetId: '31566704' }

        expect(initialRoute()).toBe('InputAmount')
    })

    it('goes straight to the recipient for a prefilled unique collectible', () => {
        state.send = { canSelectAsset: false, selectedAssetId: '1234' }
        state.isCollectible = true

        expect(initialRoute()).toBe('SelectDestination')
    })
})
