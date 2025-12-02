/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useAlgorandClient, useSigningRequest } from '../../hooks'
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { useBlockchainStore } from '../../store'

// Mock AlgorandClient factory methods so we can assert which one is chosen
vi.mock('@algorandfoundation/algokit-utils', () => {
    return {
        AlgorandClient: {
            testNet: vi.fn(() => 'TESTNET_CLIENT'),
            mainNet: vi.fn(() => 'MAINNET_CLIENT'),
            fromEnvironment: vi.fn(() => 'ENV_CLIENT'),
            fromConfig: vi.fn(() => 'FROM_CONFIG_CLIENT'),
        },
    }
})

// Mock the zustand-bound store to avoid persistence/container setup for these unit tests
const storeMock = vi.hoisted(() => {
    let state: any = { network: 'mainnet' }
    return {
        create() {
            const useBlockchainStore: any = (selector?: any) =>
                selector ? selector(state) : state
                ; (useBlockchainStore as any).getState = () => state
                ; (useBlockchainStore as any).setState = (partial: any) => {
                    state = { ...state, ...partial }
                }
            return { useBlockchainStore }
        },
    }
})
vi.mock('../../store', () => storeMock.create())

describe('services/blockchain/useSigningRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks()
            ; (useBlockchainStore as any).setState({ network: 'mainnet' })
    })

    test('useSigningRequest returns signing request state and methods', () => {
        const mockRequests = [{ id: '1' }]
        const mockAdd = vi.fn()
        const mockRemove = vi.fn()

            ; (useBlockchainStore as any).setState({
                pendingSignRequests: mockRequests,
                addSignRequest: mockAdd,
                removeSignRequest: mockRemove,
            })

        const { result } = renderHook(() => useSigningRequest())

        expect(result.current.pendingSignRequests).toBe(mockRequests)
        expect(result.current.addSignRequest).toBe(mockAdd)
        expect(result.current.removeSignRequest).toBe(mockRemove)
    })
})
