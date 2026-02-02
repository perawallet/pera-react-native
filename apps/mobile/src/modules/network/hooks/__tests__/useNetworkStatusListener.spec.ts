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

import { renderHook } from '@testing-library/react'
import { useNetworkStatusListener } from '../useNetworkStatusListener'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@react-native-community/netinfo', () => ({
    default: {
        addEventListener: vi.fn(),
    },
}))

vi.mock('@tanstack/react-query', () => ({
    onlineManager: {
        setOnline: vi.fn(),
    },
}))

vi.mock('../../../hooks/useToast', () => ({
    useToast: () => ({
        showToast: vi.fn(),
    }),
}))

const mockSetHasInternet = vi.fn()

vi.mock('../useNetworkStatusStore', () => ({
    useNetworkStatusStore: vi.fn(selector => {
        const state = {
            setHasInternet: mockSetHasInternet,
            hasInternet: true,
        }
        return selector(state)
    }),
}))

describe('useNetworkStatusListener', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('subscribes to NetInfo and updates onlineManager on change', () => {
        // Capture the listener
        let listener: ((state: NetInfoState) => void) | undefined

        const addEventListenerMock = vi
            .mocked(NetInfo.addEventListener)
            .mockImplementation(cb => {
                listener = cb
                return vi.fn()
            })

        const { unmount } = renderHook(() => useNetworkStatusListener())

        expect(addEventListenerMock).toHaveBeenCalled()
        expect(listener).toBeDefined()

        if (listener) {
            // Simulate offline
            listener({ isConnected: false } as NetInfoState)
            expect(mockSetHasInternet).toHaveBeenCalledWith(false)
            expect(onlineManager.setOnline).toHaveBeenCalledWith(false)

            // Simulate online
            listener({ isConnected: true } as NetInfoState)
            expect(mockSetHasInternet).toHaveBeenCalledWith(true)
            expect(onlineManager.setOnline).toHaveBeenCalledWith(true)
        }

        unmount()
    })
})
