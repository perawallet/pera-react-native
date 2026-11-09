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

// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'

const mocks = vi.hoisted(() => ({
    addToken: vi.fn(),
    receivesUnaskedAssets: vi.fn(),
    isNativeAssetId: vi.fn(),
}))

vi.mock('../useAddTokenMutation', () => ({
    useAddTokenMutation: () => ({ addToken: mocks.addToken }),
}))

vi.mock('../../chainProtocol', () => ({
    receivesUnaskedAssets: mocks.receivesUnaskedAssets,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    isNativeAssetId: mocks.isNativeAssetId,
}))

import { useAddIncomingTokenMutation } from '../useAddIncomingTokenMutation'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const VARIABLES = { accountAddress: '0xAA', scope: SCOPE, assetId: USDC }

beforeEach(() => {
    vi.clearAllMocks()
    mocks.addToken.mockResolvedValue(undefined)
    mocks.receivesUnaskedAssets.mockReturnValue(true)
    mocks.isNativeAssetId.mockReturnValue(false)
})

describe('useAddIncomingTokenMutation', () => {
    it('adds a token on a chain that receives tokens unasked', async () => {
        const { result } = renderHook(() => useAddIncomingTokenMutation())

        await result.current.addIncomingToken(VARIABLES)

        expect(mocks.addToken).toHaveBeenCalledWith(VARIABLES)
    })

    it('leaves an opt-in chain and the native coin alone', async () => {
        const { result } = renderHook(() => useAddIncomingTokenMutation())

        mocks.receivesUnaskedAssets.mockReturnValueOnce(false)
        await result.current.addIncomingToken(VARIABLES)
        mocks.isNativeAssetId.mockReturnValueOnce(true)
        await result.current.addIncomingToken(VARIABLES)

        expect(mocks.addToken).not.toHaveBeenCalled()
    })

    it('resolves when the add fails', async () => {
        mocks.addToken.mockRejectedValue(new Error('metadata unavailable'))
        const { result } = renderHook(() => useAddIncomingTokenMutation())

        await expect(
            result.current.addIncomingToken(VARIABLES),
        ).resolves.toBeUndefined()
    })

    it('resolves when the chain has no assets adapter to tell its native coin', async () => {
        mocks.isNativeAssetId.mockImplementation(() => {
            throw new Error('No assets adapter is registered')
        })
        const { result } = renderHook(() => useAddIncomingTokenMutation())

        await expect(
            result.current.addIncomingToken(VARIABLES),
        ).resolves.toBeUndefined()
        expect(mocks.addToken).not.toHaveBeenCalled()
    })
})
