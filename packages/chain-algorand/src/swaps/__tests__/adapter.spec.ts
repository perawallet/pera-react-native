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
    SwapHistoryItem,
} from '@perawallet/wallet-core-swaps'
import { Decimal } from 'decimal.js'
import { PeraServiceUnavailableError } from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from '../../chain-id'
import { algorandDescriptor } from '../../descriptor'
import { algorandSwapAdapter } from '../adapter'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

const mocks = vi.hoisted(() => ({
    explorerUrl: 'https://explorer.test' as string | undefined,
    isQuantumSwapEnabled: vi.fn(),
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

const params = { quote: { quoteId: 'q' } } as unknown as ExecuteSwapParams

const scope = { chainId: LEGACY_CHAIN_ID, networkId: 'testnet' } as const

const context: SwapExecutionContext = {
    scope,
    deviceId: 'device-1',
    addSignRequest: vi.fn(),
    createOrder: vi.fn(),
    reportOrder: vi.fn(),
    registerHandoff: vi.fn(),
}

const caip2Of = (networkId: string): string => {
    const caip2 = algorandDescriptor.networks.find(
        network => network.id === networkId,
    )?.caip2
    if (!caip2) throw new Error(`no CAIP-2 for ${networkId}`)
    return caip2
}

const historyItem = (
    transactions: SwapHistoryItem['transactions'],
): SwapHistoryItem => ({ transactions }) as SwapHistoryItem

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

    it('writes ALGO and an ASA as router ids on the scope network', () => {
        const caip2 = caip2Of('testnet')

        expect(algorandSwapAdapter.toRouterAssetId('0', scope)).toBe(
            `${caip2}/asa:0`,
        )
        expect(algorandSwapAdapter.toRouterAssetId('31566704', scope)).toBe(
            `${caip2}/asa:31566704`,
        )
    })

    it('reads back ALGO and an ASA on the scope network', () => {
        const caip2 = caip2Of('testnet')

        expect(
            algorandSwapAdapter.fromRouterAssetId(`${caip2}/asa:0`, scope),
        ).toBe('0')
        expect(
            algorandSwapAdapter.fromRouterAssetId(
                `${caip2}/asa:31566704`,
                scope,
            ),
        ).toBe('31566704')
    })

    it("refuses a leading-zero id, another network's id and another namespace", () => {
        const caip2 = caip2Of('testnet')

        expect(
            algorandSwapAdapter.fromRouterAssetId(`${caip2}/asa:007`, scope),
        ).toBeNull()
        expect(
            algorandSwapAdapter.fromRouterAssetId(
                `${caip2Of('mainnet')}/asa:7`,
                scope,
            ),
        ).toBeNull()
        expect(
            algorandSwapAdapter.fromRouterAssetId(`${caip2}/slip44:283`, scope),
        ).toBeNull()
    })

    it('has no router id on a network the router does not name', () => {
        const custom = {
            chainId: LEGACY_CHAIN_ID,
            networkId: 'custom',
        } as const

        expect(() => algorandSwapAdapter.toRouterAssetId('0', custom)).toThrow(
            PeraServiceUnavailableError,
        )
        expect(
            algorandSwapAdapter.fromRouterAssetId('x/asa:0', custom),
        ).toBeNull()
    })

    it('holds back 0.1 ALGO from a percentage amount', () => {
        expect(algorandSwapAdapter.maxAmountFeeReserve).toEqual(
            new Decimal(100_000),
        )
    })

    it('links a history item to its swap transaction on the explorer', () => {
        expect(
            algorandSwapAdapter.swapExplorerUrl(
                scope,
                historyItem([
                    { scope, txHash: 'OPTIN', role: 'opt_in' },
                    { scope, txHash: 'SWAP', role: 'swap' },
                ]),
            ),
        ).toBe('https://explorer.test/tx/SWAP/')
    })

    it('has no history link without a swap transaction or an explorer', () => {
        expect(
            algorandSwapAdapter.swapExplorerUrl(scope, historyItem([])),
        ).toBeUndefined()

        mocks.explorerUrl = undefined
        expect(
            algorandSwapAdapter.swapExplorerUrl(
                scope,
                historyItem([{ scope, txHash: 'SWAP', role: 'swap' }]),
            ),
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
                createOrder: context.createOrder,
                reportOrder: context.reportOrder,
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
