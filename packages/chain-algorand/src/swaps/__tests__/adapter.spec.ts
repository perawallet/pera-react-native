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
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import type {
    ExecuteSwapParams,
    SwapExecutionContext,
} from '@perawallet/wallet-core-swaps'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandSwapAdapter } from '../adapter'

const mocks = vi.hoisted(() => ({
    executeAlgorandSwap: vi.fn(),
    getAlgorandClient: vi.fn(),
    encodeSignedTransactions: vi.fn(),
}))

vi.mock('../executeSwap', () => ({
    executeAlgorandSwap: mocks.executeAlgorandSwap,
}))
vi.mock('../../blockchain', () => ({
    getAlgorandClient: mocks.getAlgorandClient,
    decodeTransaction: vi.fn(),
    decodeSignedTransaction: vi.fn(),
    encodeSignedTransactions: mocks.encodeSignedTransactions,
}))

const params = { quote: { quoteIdStr: 'q' } } as unknown as ExecuteSwapParams

const scope = scopeForLegacyNetwork('testnet')

const context: SwapExecutionContext = {
    scope,
    assetOptInMinBalance: 100_000n,
    deviceId: 'device-1',
    addSignRequest: vi.fn(),
    prepareTransactions: vi.fn(),
    updateSwapStatus: vi.fn(),
    registerHandoff: vi.fn(),
}

describe('algorandSwapAdapter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getAlgorandClient.mockImplementation((target: unknown) => ({
            target,
        }))
    })

    it('serves the Algorand chain, paying with ALGO by default', () => {
        expect(algorandSwapAdapter.chainId).toBe(ALGORAND_CHAIN_ID)
        expect(algorandSwapAdapter.nativeAssetId).toBe('0')
    })

    it("executes with a client built from the context's scope and the opt-in balance as the asset MBR", async () => {
        mocks.executeAlgorandSwap.mockResolvedValue({ kind: 'cancelled' })

        const result = await algorandSwapAdapter.executeSwap(params, context)

        expect(result).toEqual({ kind: 'cancelled' })
        const [passedParams, algorandContext] =
            mocks.executeAlgorandSwap.mock.calls[0]
        expect(passedParams).toBe(params)
        expect(mocks.getAlgorandClient).toHaveBeenCalledWith(scope)
        expect(algorandContext).toEqual(
            expect.objectContaining({
                scope,
                network: 'testnet',
                algorandClient: { target: scope },
                assetMbr: 100_000n,
                deviceId: 'device-1',
                addSignRequest: context.addSignRequest,
                prepareTransactions: context.prepareTransactions,
                updateSwapStatus: context.updateSwapStatus,
                registerHandoff: context.registerHandoff,
                encodeSignedTransactions: mocks.encodeSignedTransactions,
            }),
        )
        expect(algorandContext).not.toHaveProperty('assetOptInMinBalance')
    })

    it('finishes co-signed swaps, which its broadcaster submits', () => {
        expect(algorandSwapAdapter.supportsCosignedSwaps).toBe(true)
    })
})
