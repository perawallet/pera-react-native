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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initWalletConnectStore } from '../store'
import { useKeyValueStorageService } from '@perawallet/wallet-core-platform-integration'

// Mock dependencies
vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useKeyValueStorageService: vi.fn(),
}))

const mockSet = vi.fn()
const mockGet = vi.fn()
const mockStore = {
    setState: mockSet,
    getState: mockGet,
    subscribe: vi.fn(),
    destroy: vi.fn(),
}

// We capture the state creator function passed to `create`
let stateCreator: any

vi.mock('zustand', async () => {
    const actual = await vi.importActual('zustand')
    return {
        ...actual,
        create: () => (creator: any) => {
            // This handling is for the curried create()(...) pattern
            if (typeof creator === 'function') {
                // If persist middleware wraps it, it might be complex.
                // But let's try to capture what we can.
                stateCreator = creator
                return () => mockStore
            }
            // Handle the case where middleware is applied
            return (creatorFn: any) => {
                stateCreator = creatorFn
                return () => mockStore
            }
        }
    }
})

vi.mock('zustand/middleware', () => ({
    persist: (config: any, options: any) => {
        // Return the config executor so create can use it?
        // Or just return the config which is the state creator.
        // We also want to check options (partialize)
        (global as any).mockPersistOptions = options
        return config
    },
    createJSONStorage: vi.fn().mockReturnValue('mock-storage-impl'),
}))


vi.mock('@perawallet/wallet-core-shared', () => ({
    createLazyStore: vi.fn().mockReturnValue({
        useStore: vi.fn(),
        init: vi.fn(),
    }),
    logger: {
        debug: vi.fn(),
        error: vi.fn(),
    },
}))

describe('WalletConnectStore', () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should initialize store with storage service', () => {
        const mockStorage = {}
            ; (useKeyValueStorageService as any).mockReturnValue(mockStorage)

        initWalletConnectStore()

        expect(useKeyValueStorageService).toHaveBeenCalled()
    })

    it('should define actions correctly', () => {
        // Trigger init to run `createWalletConnectStore`
        initWalletConnectStore()

        const set = vi.fn()
        const get = vi.fn()
        const storeState = stateCreator(set, get, { getState: get, setState: set })

        expect(storeState.walletConnectSessions).toEqual([])
        expect(storeState.sessionRequests).toEqual([])

        // Test setWalletConnectSessions
        const sessions = [{ session: { clientId: '1' } }]
        storeState.setWalletConnectSessions(sessions)
        expect(set).toHaveBeenCalledWith({ walletConnectSessions: sessions })

        // Test setSessionRequests
        const requests = [{ id: 1 }]
        storeState.setSessionRequests(requests)
        expect(set).toHaveBeenCalledWith({ sessionRequests: requests })
    })

    it('should configure persistence correctly', () => {
        initWalletConnectStore()
        const options = (global as any).mockPersistOptions
        expect(options.name).toBe('wallet-connect-store')
        expect(options.version).toBe(1)

        // Test partialize
        const fullState = {
            walletConnectSessions: ['s1'],
            sessionRequests: ['r1'],
            setWalletConnectSessions: () => { },
        }
        const persisted = options.partialize(fullState)
        expect(persisted).toEqual({ walletConnectSessions: ['s1'] })
    })
})
