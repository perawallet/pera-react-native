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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    algorandCapabilityDefaults,
    algorandDescriptor,
} from '@perawallet/wallet-core-chain-algorand/descriptor'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    allCapabilities,
    ETHEREUM_CHAIN_ID,
    fixtureEthereumDescriptor,
} from '@test-utils/chain-fixtures'
import { algorandChainUi } from '@modules/algorand/chain-ui'
import { useTransactionListFooter } from '../useTransactionListFooter'

const mockPipeline = vi.hoisted(() => ({
    currentRequest: undefined as unknown,
}))

vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-signing')
    >()),
    useSigningPipeline: () => mockPipeline,
}))

const requestOn = (chainId: string) => ({
    type: 'transactions',
    txs: [{ scope: { chainId, networkId: 'testnet' }, payload: {} }],
})

describe('useTransactionListFooter', () => {
    beforeEach(() => {
        getProvider().chains.reset()
        getProvider().chains.register(
            algorandDescriptor,
            algorandCapabilityDefaults,
        )
        getProvider().chains.register(
            { ...fixtureEthereumDescriptor, family: 'evm' },
            allCapabilities(false),
        )
    })

    it("shows the request chain's total fee", () => {
        mockPipeline.currentRequest = requestOn('algorand')

        const { result } = renderHook(() => useTransactionListFooter())

        expect(result.current.TotalFee).toBe(
            algorandChainUi.transactionDetails?.TotalFee,
        )
    })

    it('shows no total fee for a chain whose UI has none', () => {
        mockPipeline.currentRequest = requestOn(ETHEREUM_CHAIN_ID)

        const { result } = renderHook(() => useTransactionListFooter())

        expect(result.current.TotalFee).toBeNull()
    })

    it('shows no total fee without a request', () => {
        mockPipeline.currentRequest = undefined

        const { result } = renderHook(() => useTransactionListFooter())

        expect(result.current.TotalFee).toBeNull()
    })
})
