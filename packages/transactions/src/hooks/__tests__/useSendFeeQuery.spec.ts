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
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useMinFeeForSender } from '@perawallet/wallet-core-signing'
import { sendFlowChainAdapters } from '../../chain-adapter'
import { useTransferFeeEstimateQuery } from '../useTransferFeeEstimateQuery'
import { useSendFeeQuery } from '../useSendFeeQuery'

vi.mock('@perawallet/wallet-core-signing', () => ({
    useMinFeeForSender: vi.fn(),
}))

vi.mock('../../chain-adapter', () => ({
    sendFlowChainAdapters: { has: vi.fn() },
}))

vi.mock('../useTransferFeeEstimateQuery', () => ({
    useTransferFeeEstimateQuery: vi.fn(),
}))

const ALGORAND: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

const PRESETS = {
    slow: {
        amount: new Decimal(10),
        maxAmount: new Decimal(20),
        estimatedWaitSeconds: 60,
    },
    normal: {
        amount: new Decimal(30),
        maxAmount: new Decimal(40),
        estimatedWaitSeconds: 36,
    },
    fast: {
        amount: new Decimal(50),
        maxAmount: new Decimal(60),
        estimatedWaitSeconds: 12,
    },
}

describe('useSendFeeQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(sendFlowChainAdapters.has as Mock).mockImplementation(
            (chainId: string) => chainId === 'algorand',
        )
        ;(useMinFeeForSender as Mock).mockReturnValue({
            minFee: undefined,
            isPending: false,
        })
        ;(useTransferFeeEstimateQuery as Mock).mockReturnValue({
            data: undefined,
            isPending: false,
            isError: false,
        })
    })

    it('keeps the PQ-aware sender fee on a chain with a send-flow adapter', () => {
        ;(useMinFeeForSender as Mock).mockReturnValue({
            minFee: 3000n,
            isPending: false,
        })

        const { result } = renderHook(() =>
            useSendFeeQuery({
                scope: ALGORAND,
                senderAddress: 'SENDER',
                assetId: '0',
                feePreset: 'normal',
            }),
        )

        expect(useMinFeeForSender).toHaveBeenCalledWith('SENDER', 'algorand')
        expect(useTransferFeeEstimateQuery).toHaveBeenCalledWith(undefined, {
            isLive: undefined,
        })
        expect(result.current).toEqual({
            feeAmount: new Decimal(3000),
            maxFeeAmount: new Decimal(3000),
            presets: undefined,
            isPending: false,
            isError: false,
            refresh: expect.any(Function),
        })
    })

    it('prices the transfer through the transfer adapter on a chain without a send-flow adapter', () => {
        renderHook(() =>
            useSendFeeQuery({
                scope: ETHEREUM,
                senderAddress: '0xSENDER',
                assetId: 'native',
                recipient: '0xRECEIVER',
                amount: new Decimal(5),
                feePreset: 'normal',
            }),
        )

        expect(useTransferFeeEstimateQuery).toHaveBeenCalledWith(
            {
                intent: {
                    kind: 'transfer',
                    from: '0xSENDER',
                    to: '0xRECEIVER',
                    assetRef: { chainId: 'ethereum', assetId: 'native' },
                    amount: new Decimal(5),
                },
                scope: ETHEREUM,
            },
            { isLive: undefined },
        )
    })

    it('prices against the sender before a receiver and amount are chosen', () => {
        renderHook(() =>
            useSendFeeQuery({
                scope: ETHEREUM,
                senderAddress: '0xSENDER',
                assetId: 'native',
                feePreset: 'normal',
            }),
        )

        expect(useTransferFeeEstimateQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                intent: expect.objectContaining({
                    to: '0xSENDER',
                    amount: new Decimal(0),
                }),
            }),
            { isLive: undefined },
        )
    })

    it('asks for a live estimate only when the caller does', () => {
        renderHook(() =>
            useSendFeeQuery({
                scope: ETHEREUM,
                senderAddress: '0xSENDER',
                assetId: 'native',
                feePreset: 'normal',
                isLive: true,
            }),
        )

        expect(useTransferFeeEstimateQuery).toHaveBeenCalledWith(
            expect.anything(),
            { isLive: true },
        )
    })

    it("reads the chosen preset's expected and most-chargeable fee", () => {
        ;(useTransferFeeEstimateQuery as Mock).mockReturnValue({
            data: {
                assetRef: { chainId: 'ethereum', assetId: 'native' },
                amount: PRESETS.normal.amount,
                presets: PRESETS,
            },
            isPending: false,
            isError: false,
        })

        const { result } = renderHook(() =>
            useSendFeeQuery({
                scope: ETHEREUM,
                senderAddress: '0xSENDER',
                assetId: 'native',
                feePreset: 'fast',
            }),
        )

        expect(result.current.feeAmount).toEqual(new Decimal(50))
        expect(result.current.maxFeeAmount).toEqual(new Decimal(60))
        expect(result.current.presets).toBe(PRESETS)
    })

    it('estimates nothing until the sender and asset are known', () => {
        const { result } = renderHook(() =>
            useSendFeeQuery({
                scope: ETHEREUM,
                senderAddress: undefined,
                assetId: 'native',
                feePreset: 'normal',
            }),
        )

        expect(useTransferFeeEstimateQuery).toHaveBeenCalledWith(undefined, {
            isLive: undefined,
        })
        expect(result.current.maxFeeAmount).toBeUndefined()
    })

    it('reports a failed estimate as an error rather than a zero fee', () => {
        ;(useTransferFeeEstimateQuery as Mock).mockReturnValue({
            data: undefined,
            isPending: false,
            isError: true,
        })

        const { result } = renderHook(() =>
            useSendFeeQuery({
                scope: ETHEREUM,
                senderAddress: '0xSENDER',
                assetId: 'native',
                feePreset: 'normal',
            }),
        )

        expect(result.current.isError).toBe(true)
        expect(result.current.maxFeeAmount).toBeUndefined()
    })
})
