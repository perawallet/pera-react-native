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
import type {
    ExecuteSwapParams,
    SwapExecutionContext,
} from '@perawallet/wallet-core-swaps'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandSwapAdapter } from '../adapter'

const mocks = vi.hoisted(() => ({
    executeAlgorandSwap: vi.fn(),
    getAlgorandClient: vi.fn(),
    submitRawSignedTransactionGroup: vi.fn(),
    encodeSignedTransactions: vi.fn(),
}))

vi.mock('../executeSwap', () => ({
    executeAlgorandSwap: mocks.executeAlgorandSwap,
}))
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    getAlgorandClient: mocks.getAlgorandClient,
    decodeTransaction: vi.fn(),
    decodeSignedTransaction: vi.fn(),
    encodeSignedTransactions: mocks.encodeSignedTransactions,
}))
vi.mock('@perawallet/wallet-core-signing', () => ({
    submitRawSignedTransactionGroup: mocks.submitRawSignedTransactionGroup,
}))

const params = { quote: { quoteIdStr: 'q' } } as unknown as ExecuteSwapParams

const context: SwapExecutionContext = {
    network: 'testnet',
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
        mocks.getAlgorandClient.mockImplementation((network: string) => ({
            network,
        }))
    })

    it('serves the Algorand chain', () => {
        expect(algorandSwapAdapter.chainId).toBe(ALGORAND_CHAIN_ID)
    })

    it("executes with a client for the context's network and the opt-in balance as the asset MBR", async () => {
        mocks.executeAlgorandSwap.mockResolvedValue({ kind: 'cancelled' })

        const result = await algorandSwapAdapter.executeSwap(params, context)

        expect(result).toEqual({ kind: 'cancelled' })
        const [passedParams, algorandContext] =
            mocks.executeAlgorandSwap.mock.calls[0]
        expect(passedParams).toBe(params)
        expect(algorandContext).toEqual(
            expect.objectContaining({
                network: 'testnet',
                algorandClient: { network: 'testnet' },
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

    it("submits a co-signed group through algod on the handoff's network", async () => {
        mocks.submitRawSignedTransactionGroup.mockResolvedValue(['TX1'])
        const bytes = [new Uint8Array([1, 2])]

        const ids = await algorandSwapAdapter.submitSignedGroup(
            'mainnet',
            bytes,
        )

        expect(ids).toEqual(['TX1'])
        expect(mocks.submitRawSignedTransactionGroup).toHaveBeenCalledWith(
            { network: 'mainnet' },
            bytes,
        )
    })
})
