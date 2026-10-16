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

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    plannerChainAdapters,
    useMinFeeForSender,
} from '@perawallet/wallet-core-signing'
import { useTransferFeeEstimateQuery } from '@perawallet/wallet-core-transactions'
import { useSendFee } from '../useSendFee'

vi.mock('@perawallet/wallet-core-signing', () => ({
    plannerChainAdapters: { has: vi.fn() },
    useMinFeeForSender: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-transactions', () => ({
    useTransferFeeEstimateQuery: vi.fn(),
}))

const ALGORAND: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

const PRESETS = {
    slow: { amount: new Decimal(10), maxAmount: new Decimal(20) },
    normal: { amount: new Decimal(30), maxAmount: new Decimal(40) },
    fast: { amount: new Decimal(50), maxAmount: new Decimal(60) },
}

describe('useSendFee', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(plannerChainAdapters.has as Mock).mockImplementation(
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

    it("keeps the planner's sender fee on a chain with a planner", () => {
        ;(useMinFeeForSender as Mock).mockReturnValue({
            minFee: 3000n,
            isPending: false,
        })

        const { result } = renderHook(() =>
            useSendFee({
                scope: ALGORAND,
                senderAddress: 'SENDER',
                assetId: '0',
                feePreset: 'normal',
            }),
        )

        expect(useMinFeeForSender).toHaveBeenCalledWith('SENDER', 'algorand')
        expect(useTransferFeeEstimateQuery).toHaveBeenCalledWith(undefined)
        expect(result.current).toEqual({
            feeAmount: new Decimal(3000),
            maxFeeAmount: new Decimal(3000),
            presets: undefined,
            isPending: false,
        })
    })

    it('prices the transfer through the transfer adapter on a chain without one', () => {
        renderHook(() =>
            useSendFee({
                scope: ETHEREUM,
                senderAddress: '0xSENDER',
                assetId: 'native',
                recipient: '0xRECEIVER',
                amount: new Decimal(5),
                feePreset: 'normal',
            }),
        )

        expect(useTransferFeeEstimateQuery).toHaveBeenCalledWith({
            intent: {
                kind: 'transfer',
                from: '0xSENDER',
                to: '0xRECEIVER',
                assetRef: { chainId: 'ethereum', assetId: 'native' },
                amount: new Decimal(5),
            },
            scope: ETHEREUM,
        })
    })

    it('prices against the sender before a receiver and amount are chosen', () => {
        renderHook(() =>
            useSendFee({
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
            useSendFee({
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
            useSendFee({
                scope: ETHEREUM,
                senderAddress: undefined,
                assetId: 'native',
                feePreset: 'normal',
            }),
        )

        expect(useTransferFeeEstimateQuery).toHaveBeenCalledWith(undefined)
        expect(result.current.maxFeeAmount).toBeUndefined()
    })
})
