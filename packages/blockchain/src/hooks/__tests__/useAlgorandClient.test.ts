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

import { describe, test, expect, beforeEach, vi, Mock } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useAlgorandClient } from '../../hooks'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { useNetwork } from '../useNetwork'
import { useCustomNetworkStore } from '../../store'
import { createTimeoutBoundedAlgorandClient } from '../../utils/createAlgorandClient'

// Mock AlgorandClient factory methods so we can assert which one is chosen
vi.mock('@algorandfoundation/algokit-utils', () => {
    const mockClient = {
        setDefaultSigner: vi.fn(),
        setDefaultValidityWindow: vi.fn(),
        registerErrorTransformer: vi.fn(),
    }
    return {
        AlgorandClient: {
            testNet: vi.fn(() => mockClient),
            mainNet: vi.fn(() => mockClient),
            fromEnvironment: vi.fn(() => mockClient),
            fromClients: vi.fn(() => mockClient),
        },
    }
})

// Mock useNetwork
vi.mock('../useNetwork', () => ({
    useNetwork: vi.fn(() => ({ network: 'mainnet' })),
}))

// Mock encodeSignedTransactions
vi.mock('../../utils/transact', () => ({
    encodeSignedTransactions: vi.fn(txs => txs),
}))

// Spy on createTimeoutBoundedAlgorandClient while still delegating to the
// real implementation — every test in this file relies on the REAL chain
// running through to the (mocked) AlgorandClient.fromClients, so this must
// not become a stub.
vi.mock('../../utils/createAlgorandClient', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('../../utils/createAlgorandClient')
        >()
    return {
        ...actual,
        createTimeoutBoundedAlgorandClient: vi.fn(
            actual.createTimeoutBoundedAlgorandClient,
        ),
    }
})

describe('services/blockchain/hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        ;(useNetwork as Mock).mockReturnValue({ network: 'mainnet' })
        useCustomNetworkStore.getState().resetState()
    })

    test('returns fromClients client for mainnet', () => {
        ;(useNetwork as Mock).mockReturnValue({ network: 'mainnet' })
        const { result } = renderHook(() => useAlgorandClient())

        expect(AlgorandClient.fromClients).toHaveBeenCalledTimes(1)
        expect(result.current.setDefaultSigner).toHaveBeenCalledTimes(1)
    })

    test('returns fromClients client for testnet', () => {
        ;(useNetwork as Mock).mockReturnValue({ network: 'testnet' })
        const { result } = renderHook(() => useAlgorandClient())

        expect(AlgorandClient.fromClients).toHaveBeenCalledTimes(1)
        expect(result.current.setDefaultSigner).toHaveBeenCalledTimes(1)
    })

    test('registers a placeholder default signer when no real signer is supplied so composer.build() succeeds', async () => {
        const { result } = renderHook(() => useAlgorandClient())

        const placeholder = (result.current.setDefaultSigner as Mock).mock
            .calls[0][0]
        await expect(placeholder()).rejects.toThrow(/should not be invoked/)
    })

    test('sets a 1000-round default validity window so hardware-wallet users can confirm on-device before expiry', () => {
        const { result } = renderHook(() => useAlgorandClient())

        expect(result.current.setDefaultValidityWindow).toHaveBeenCalledWith(
            1000,
        )
    })

    test('registers the algod error transformer on the built client', () => {
        const { result } = renderHook(() => useAlgorandClient())

        expect(result.current.registerErrorTransformer).toHaveBeenCalledTimes(1)
    })

    test('configures signer when provided', async () => {
        ;(useNetwork as Mock).mockReturnValue({ network: 'mainnet' })
        const mockSigner = vi.fn().mockResolvedValue(['signed-tx'])
        const { result } = renderHook(() => useAlgorandClient(mockSigner))

        expect(result.current.setDefaultSigner).toHaveBeenCalledTimes(1)

        // Verify the encoding wrapper
        const encodingSigner = (result.current.setDefaultSigner as Mock).mock
            .calls[0][0]
        const resultTx = await encodingSigner({ txnGroup: [] }, [])

        expect(mockSigner).toHaveBeenCalled()
        expect(resultTx).toEqual(['signed-tx'])
    })

    test('re-memoizes the client when the custom-network config changes while the active network is custom', () => {
        ;(useNetwork as Mock).mockReturnValue({ network: 'custom' })
        useCustomNetworkStore.getState().setCustomNetwork({
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            genesisHash: 'HASH',
            genesisId: 'dockernet-v1',
        })

        const { rerender } = renderHook(() => useAlgorandClient())

        expect(createTimeoutBoundedAlgorandClient).toHaveBeenCalledTimes(1)
        expect(createTimeoutBoundedAlgorandClient).toHaveBeenNthCalledWith(1, {
            algodUrl: 'http://10.0.0.5:4001',
            indexerUrl: 'http://10.0.0.5:8980',
            algodToken: '',
            indexerToken: '',
        })

        useCustomNetworkStore.getState().setCustomNetwork({
            algodUrl: 'http://10.0.0.9:4001',
            indexerUrl: 'http://10.0.0.9:8980',
            genesisHash: 'HASH2',
            genesisId: 'dockernet-v2',
        })
        rerender()

        // A stale memo (deps missing customNetwork) would still show only 1
        // call here and the OLD endpoint — this is the exact defect a prior
        // review caught by mutation: dropping customNetwork from the deps
        // array left the whole package suite green.
        expect(createTimeoutBoundedAlgorandClient).toHaveBeenCalledTimes(2)
        expect(createTimeoutBoundedAlgorandClient).toHaveBeenNthCalledWith(2, {
            algodUrl: 'http://10.0.0.9:4001',
            indexerUrl: 'http://10.0.0.9:8980',
            algodToken: '',
            indexerToken: '',
        })
    })
})
