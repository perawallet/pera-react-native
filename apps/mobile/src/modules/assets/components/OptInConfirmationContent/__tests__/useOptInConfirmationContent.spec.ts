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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { ETHEREUM_CHAIN_ID } from '@test-utils/chain-fixtures'
import { useOptInConfirmationContent } from '../useOptInConfirmationContent'

const mockUseFeeConfig = vi.fn()
const mockUseMinFeeForSender = vi.fn()

vi.mock('@perawallet/wallet-core-signing', () => ({
    useFeeConfig: (chainId: string) => mockUseFeeConfig(chainId),
    useMinFeeForSender: (address: string, chainId: string) =>
        mockUseMinFeeForSender(address, chainId),
}))

const NATIVE_ASSETS = vi.hoisted(() => ({
    algorand: { assetId: '0', name: 'Algo', unitName: 'ALGO', decimals: 6 },
    ethereum: { assetId: 'eth', name: 'Ether', unitName: 'ETH', decimals: 18 },
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useNativeAsset: (scope: { chainId: keyof typeof NATIVE_ASSETS }) =>
        NATIVE_ASSETS[scope.chainId],
    toWholeUnits: (value: number | bigint, asset: { decimals: number }) =>
        new Decimal(value.toString()).div(new Decimal(10).pow(asset.decimals)),
}))

const ALGORAND_SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ETHEREUM_SCOPE: ChainScope = {
    chainId: ETHEREUM_CHAIN_ID,
    networkId: 'mainnet',
}

describe('useOptInConfirmationContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseFeeConfig.mockReturnValue({ minTxnFee: 1000n })
        mockUseMinFeeForSender.mockReturnValue({
            minFee: undefined,
            isPending: true,
        })
    })

    it('falls back to the remote-config minimum while params load', () => {
        mockUseFeeConfig.mockReturnValue({ minTxnFee: 2000n })
        const { result } = renderHook(() =>
            useOptInConfirmationContent('SENDER', ALGORAND_SCOPE),
        )
        expect(result.current.resolvedFee.toString()).toBe('0.002')
    })

    // a quantum sender pays the PQ multiple, and the quote has to
    // match the fee useAssetOptInMutation actually builds.
    it('quotes the sender-resolved fee once it is available', () => {
        mockUseMinFeeForSender.mockReturnValue({
            minFee: 3000n,
            isPending: false,
        })
        const { result } = renderHook(() =>
            useOptInConfirmationContent('QUANTUM_SENDER', ALGORAND_SCOPE),
        )
        expect(mockUseMinFeeForSender).toHaveBeenCalledWith(
            'QUANTUM_SENDER',
            'algorand',
        )
        expect(result.current.resolvedFee.toString()).toBe('0.003')
    })

    it('reads fees on the scope chain and quotes them in its native asset', () => {
        mockUseFeeConfig.mockReturnValue({ minTxnFee: 21_000_000_000_000n })
        const { result } = renderHook(() =>
            useOptInConfirmationContent('0xSENDER', ETHEREUM_SCOPE),
        )
        expect(mockUseFeeConfig).toHaveBeenCalledWith(ETHEREUM_CHAIN_ID)
        expect(mockUseMinFeeForSender).toHaveBeenCalledWith(
            '0xSENDER',
            ETHEREUM_CHAIN_ID,
        )
        expect(result.current.resolvedFee.toString()).toBe('0.000021')
    })

    it('prefers an explicit fee override over the resolved value', () => {
        mockUseMinFeeForSender.mockReturnValue({
            minFee: 3000n,
            isPending: false,
        })
        const { result } = renderHook(() =>
            useOptInConfirmationContent(
                'SENDER',
                ALGORAND_SCOPE,
                new Decimal(0),
            ),
        )
        expect(result.current.resolvedFee.toString()).toBe('0')
    })
})
