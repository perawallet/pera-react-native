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
    SwapHistoryItem,
} from '@perawallet/wallet-core-swaps'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandSwapAdapter } from '../adapter'

const mocks = vi.hoisted(() => ({
    explorerUrl: 'https://explorer.test' as string | undefined,
    isQuantumSwapEnabled: vi.fn(),
    executeAlgorandSwap: vi.fn(),
    getAlgorandClient: vi.fn(),
    submitRawSignedTransactionGroup: vi.fn(),
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
    getMinimumFeeConfig: () => ({ assetMbr: 250_000n }),
}))
vi.mock('../quantumSwapGate', () => ({
    isAlgorandQuantumSwapEnabled: mocks.isQuantumSwapEnabled,
}))
vi.mock('@perawallet/wallet-core-config', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-config')
    >()),
    getAlgorandChainConfig: () => ({ explorerUrl: mocks.explorerUrl }),
}))
vi.mock('../../signing', () => ({
    submitRawSignedTransactionGroup: mocks.submitRawSignedTransactionGroup,
}))

const params = { quote: { quoteIdStr: 'q' } } as unknown as ExecuteSwapParams

const scope = scopeForLegacyNetwork('testnet')

const context: SwapExecutionContext = {
    scope,
    deviceId: 'device-1',
    addSignRequest: vi.fn(),
    prepareTransactions: vi.fn(),
    updateSwapStatus: vi.fn(),
    registerHandoff: vi.fn(),
}

describe('algorandSwapAdapter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.explorerUrl = 'https://explorer.test'
        mocks.isQuantumSwapEnabled.mockReturnValue(true)
        mocks.getAlgorandClient.mockImplementation((target: unknown) => ({
            target,
        }))
    })

    it('serves the Algorand chain, paying with ALGO by default', () => {
        expect(algorandSwapAdapter.chainId).toBe(ALGORAND_CHAIN_ID)
        expect(algorandSwapAdapter.nativeAssetId).toBe('0')
        expect(algorandSwapAdapter.defaultReceiveAssetId).toBe('31566704')
    })

    it('links a history item to its transaction group on the explorer', () => {
        expect(
            algorandSwapAdapter.swapExplorerUrl(scope, {
                transactionGroupId: 'GROUP',
            } as SwapHistoryItem),
        ).toBe('https://explorer.test/tx-group/GROUP/')
    })

    it('has no history link without a group id or an explorer', () => {
        expect(
            algorandSwapAdapter.swapExplorerUrl(scope, {
                transactionGroupId: null,
            } as SwapHistoryItem),
        ).toBeUndefined()

        mocks.explorerUrl = undefined
        expect(
            algorandSwapAdapter.swapExplorerUrl(scope, {
                transactionGroupId: 'GROUP',
            } as SwapHistoryItem),
        ).toBeUndefined()
    })

    it("executes with a client built from the context's scope, resolving the asset MBR and quantum gate itself", async () => {
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
                assetMbr: 250_000n,
                isQuantumSwapEnabled: true,
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

    it('submits a co-signed group through algod for the scope it was given', async () => {
        mocks.submitRawSignedTransactionGroup.mockResolvedValue(['TX1'])
        const bytes = [new Uint8Array([1, 2])]
        const mainnetScope = scopeForLegacyNetwork('mainnet')

        const ids = await algorandSwapAdapter.submitSignedGroup?.(
            mainnetScope,
            bytes,
        )

        expect(ids).toEqual(['TX1'])
        expect(mocks.getAlgorandClient).toHaveBeenCalledWith(mainnetScope)
        expect(mocks.submitRawSignedTransactionGroup).toHaveBeenCalledWith(
            { target: mainnetScope },
            bytes,
        )
    })
})
