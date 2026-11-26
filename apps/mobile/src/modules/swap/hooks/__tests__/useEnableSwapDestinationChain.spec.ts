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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { SwapDestinationChainError } from '@packages/swaps/src/errors'
import type { SwapQuote } from '@perawallet/wallet-core-swaps'
import { useEnableSwapDestinationChain } from '../useEnableSwapDestinationChain'

const mocks = vi.hoisted(() => ({
    enableChain: vi.fn(),
    swapAccount: null as WalletAccount | null,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useEnableChain: () => mocks.enableChain,
    chainAccountOf: (account: WalletAccount, chainId: ChainId) =>
        account.chains[chainId],
}))

vi.mock('@perawallet/wallet-core-swaps', async () => ({
    ...(await vi.importActual<typeof import('@packages/swaps/src/errors')>(
        '@packages/swaps/src/errors',
    )),
    useSwapAccount: () => mocks.swapAccount,
    scopeOfSwapAsset: ({
        chainId,
        networkId,
    }: {
        chainId: string
        networkId: string
    }) => ({ chainId, networkId }),
}))

const account = (chains: WalletAccount['chains']): WalletAccount => ({
    id: 'hd',
    name: '',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains,
})

const quote = {
    request: {
        destinationAddress: '0xSWAPPER',
        destinationAsset: {
            chainId: 'base',
            networkId: 'mainnet',
            assetId: 'native',
        },
    },
} as unknown as SwapQuote

describe('useEnableSwapDestinationChain', () => {
    let pendingFrames: FrameRequestCallback[]

    beforeEach(() => {
        vi.clearAllMocks()
        pendingFrames = []
        vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(
            frame => pendingFrames.push(frame),
        )
        mocks.enableChain.mockResolvedValue(undefined)
        mocks.swapAccount = account({
            algorand: { address: 'ALGO', keyPairId: 'k1' },
            ethereum: { address: '0xSWAPPER', keyPairId: 'k2' },
        })
    })

    it('does nothing when the account is already on the destination network', async () => {
        mocks.swapAccount = account({
            base: { address: '0xSWAPPER', keyPairId: 'k2' },
        })
        const { result } = renderHook(() => useEnableSwapDestinationChain())

        await act(() => result.current.enableDestinationChain(quote))

        expect(mocks.enableChain).not.toHaveBeenCalled()
    })

    it('enables the network at the quoted address after yielding a frame', async () => {
        const { result } = renderHook(() => useEnableSwapDestinationChain())

        let promise: Promise<void> = Promise.resolve()
        act(() => {
            promise = result.current.enableDestinationChain(quote)
        })
        expect(mocks.enableChain).not.toHaveBeenCalled()
        await act(async () => {
            pendingFrames.splice(0).forEach(frame => frame(0))
            await promise
        })

        expect(mocks.enableChain).toHaveBeenCalledWith('hd', 'base', 'user', {
            expectedAddress: '0xSWAPPER',
        })
    })

    it('rejects with the network named when enabling fails', async () => {
        const cause = new Error('address mismatch')
        mocks.enableChain.mockRejectedValue(cause)
        const { result } = renderHook(() => useEnableSwapDestinationChain())

        let promise: Promise<void> = Promise.resolve()
        act(() => {
            promise = result.current.enableDestinationChain(quote)
        })
        const settled = expect(promise).rejects.toMatchObject({
            name: 'SwapDestinationChainError',
            chainId: 'base',
            originalError: cause,
        })
        await act(async () => {
            pendingFrames.splice(0).forEach(frame => frame(0))
            await settled
        })
    })

    it('rejects without a swap account', async () => {
        mocks.swapAccount = null
        const { result } = renderHook(() => useEnableSwapDestinationChain())

        await expect(
            result.current.enableDestinationChain(quote),
        ).rejects.toBeInstanceOf(SwapDestinationChainError)
        expect(mocks.enableChain).not.toHaveBeenCalled()
    })
})
