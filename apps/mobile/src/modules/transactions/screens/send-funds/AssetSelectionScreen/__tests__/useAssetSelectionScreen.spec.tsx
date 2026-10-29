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
import { Decimal } from 'decimal.js'
import type { ChainAssetBalance } from '@perawallet/wallet-core-accounts'
import { useAssetSelectionScreen } from '../useAssetSelectionScreen'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    setSelectedAsset: vi.fn(),
    setAmount: vi.fn(),
    onFinished: vi.fn(),
    setCanSelectAccount: vi.fn(),
    setSelectedAccount: vi.fn(),
    setChainId: vi.fn(),
    request: vi.fn(),
    canReceive: true,
    isCollectible: false,
}))

const account = { id: 'two-chains' }

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mocks.navigate }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => account,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    isUniqueCollectible: () => mocks.isCollectible,
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    chainDisplayNameOf: (chainId: string) =>
        ({ ethereum: 'Ethereum' })[chainId],
}))

vi.mock('@hooks/useCapability', () => ({
    useCapability: () => mocks.canReceive,
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.request }),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendScope: () => ({ chainId: 'ethereum', networkId: 'mainnet' }),
    useSendFunds: () => ({
        setSelectedAsset: mocks.setSelectedAsset,
        setAmount: mocks.setAmount,
        onFinished: mocks.onFinished,
    }),
    useReceiveFunds: () => ({
        setCanSelectAccount: mocks.setCanSelectAccount,
        setSelectedAccount: mocks.setSelectedAccount,
        setChainId: mocks.setChainId,
    }),
}))

vi.mock('../../../../components/receive-funds/ReceiveFundsContent', () => ({
    ReceiveFundsContent: () => null,
}))

const holding = {
    assetId: '0xTOKEN',
    amount: new Decimal(5),
    asset: { assetId: '0xTOKEN' },
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
} as unknown as ChainAssetBalance

describe('useAssetSelectionScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.canReceive = true
        mocks.isCollectible = false
    })

    it("names the send's network", () => {
        const { result } = renderHook(() => useAssetSelectionScreen())

        expect(result.current.chainId).toBe('ethereum')
        expect(result.current.networkName).toBe('Ethereum')
    })

    it('takes a fungible holding to the amount step', () => {
        const { result } = renderHook(() => useAssetSelectionScreen())

        act(() => result.current.handleAssetSelected(holding))

        expect(mocks.setSelectedAsset).toHaveBeenCalledWith({
            chainId: 'ethereum',
            assetId: '0xTOKEN',
        })
        expect(mocks.setAmount).not.toHaveBeenCalled()
        expect(mocks.navigate).toHaveBeenCalledWith('InputAmount')
    })

    it('takes a unique collectible straight to the recipient with an amount of 1', () => {
        mocks.isCollectible = true
        const { result } = renderHook(() => useAssetSelectionScreen())

        act(() => result.current.handleAssetSelected(holding))

        expect(mocks.setAmount).toHaveBeenCalledWith(new Decimal(1))
        expect(mocks.navigate).toHaveBeenCalledWith('SelectDestination')
    })

    it("closes the send and opens Receive on the send's network for the same account", () => {
        const { result } = renderHook(() => useAssetSelectionScreen())

        act(() => result.current.handleReceive())

        expect(mocks.onFinished).toHaveBeenCalledOnce()
        expect(mocks.setCanSelectAccount).toHaveBeenCalledWith(false)
        expect(mocks.setSelectedAccount).toHaveBeenCalledWith(account)
        expect(mocks.setChainId).toHaveBeenCalledWith('ethereum')
        const [request] = mocks.request.mock.lastCall ?? []
        expect(request.contents.props).toEqual({
            account,
            chainId: 'ethereum',
        })
    })

    it('offers Receive only where the network can receive', () => {
        mocks.canReceive = false
        const { result } = renderHook(() => useAssetSelectionScreen())

        expect(result.current.canReceive).toBe(false)
    })
})
