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

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDeleteDeviceMutation } from '../useDeleteDeviceMutation'
import { deleteDevice } from '../endpoints'
import { useDeviceStore } from '../../store'
import { useDeviceID } from '../useDeviceID'
import { Networks } from '@perawallet/wallet-core-shared'

vi.mock('../endpoints', () => ({
    deleteDevice: vi.fn(),
}))

vi.mock('../../store', async importOriginal => {
    const original = await importOriginal<typeof import('../../store')>()
    return {
        ...original,
        useDeviceStore: vi.fn(),
    }
})

vi.mock('../useDeviceID', () => ({
    useDeviceID: vi.fn(),
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        deviceInfo: {
            getDevicePlatform: () => 'ios',
        },
        keyValueStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        },
    }),
}))

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

const mockDefaultDeviceStore = () => {
    vi.mocked(useDeviceStore).mockImplementation(selector => {
        const state = {
            pushToken: 'test-push-token',
            deviceIDs: new Map([
                ['testnet', 'testnet-device-id'],
                ['mainnet', 'mainnet-device-id'],
            ]),
        }
        return selector(state as never)
    })
}

const mockDefaultDeviceID = () => {
    vi.mocked(useDeviceID).mockImplementation((network: string) => {
        if (network === 'testnet') return 'testnet-device-id'
        if (network === 'mainnet') return 'mainnet-device-id'
        return null
    })
}

describe('useDeleteDeviceMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockDefaultDeviceStore()
        mockDefaultDeviceID()
    })

    it('deletes devices on both testnet and mainnet when both are registered', async () => {
        vi.mocked(deleteDevice).mockResolvedValue(undefined)

        const { result } = renderHook(() => useDeleteDeviceMutation(), {
            wrapper: createWrapper(),
        })

        result.current.mutate()

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(deleteDevice).toHaveBeenCalledTimes(2)
        expect(deleteDevice).toHaveBeenCalledWith(Networks.testnet, {
            id: 'testnet-device-id',
        })
        expect(deleteDevice).toHaveBeenCalledWith(Networks.mainnet, {
            id: 'mainnet-device-id',
        })
        expect(result.current.data).toBeUndefined()
    })

    it('returns undefined when no devices are registered', async () => {
        vi.mocked(useDeviceID).mockReturnValue(null)

        const { result } = renderHook(() => useDeleteDeviceMutation(), {
            wrapper: createWrapper(),
        })

        result.current.mutate()

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(deleteDevice).not.toHaveBeenCalled()
        expect(result.current.data).toBeUndefined()
    })

    it('deletes a network whose device id exists even without a push token', async () => {
        vi.mocked(useDeviceStore).mockImplementation(selector => {
            const state = {
                pushToken: null,
                deviceIDs: new Map([
                    ['testnet', 'testnet-device-id'],
                    ['mainnet', 'mainnet-device-id'],
                ]),
            }
            return selector(state as never)
        })
        vi.mocked(deleteDevice).mockResolvedValue(undefined)

        const { result } = renderHook(() => useDeleteDeviceMutation(), {
            wrapper: createWrapper(),
        })

        result.current.mutate()

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        // v1 required both id and push token, so a device whose push
        // permission was never granted could not be deleted at all. v3
        // accepts `id` alone, so both networks now get deleted properly.
        expect(deleteDevice).toHaveBeenCalledTimes(2)
        expect(deleteDevice).toHaveBeenCalledWith(Networks.testnet, {
            id: 'testnet-device-id',
        })
        expect(deleteDevice).toHaveBeenCalledWith(Networks.mainnet, {
            id: 'mainnet-device-id',
        })
        expect(result.current.data).toBeUndefined()
    })

    it('handles API error', async () => {
        const mockError = new Error('Network error')
        vi.mocked(deleteDevice).mockRejectedValue(mockError)

        const { result } = renderHook(() => useDeleteDeviceMutation(), {
            wrapper: createWrapper(),
        })

        result.current.mutate()

        await waitFor(() => {
            expect(result.current.isError).toBe(true)
        })

        expect(result.current.error).toBe(mockError)
    })

    it('deletes only testnet device when mainnet is not registered', async () => {
        vi.mocked(useDeviceID).mockImplementation((network: string) => {
            if (network === 'testnet') return 'testnet-device-id'
            return null
        })

        vi.mocked(deleteDevice).mockResolvedValue(undefined)

        const { result } = renderHook(() => useDeleteDeviceMutation(), {
            wrapper: createWrapper(),
        })

        result.current.mutate()

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(deleteDevice).toHaveBeenCalledTimes(1)
        expect(deleteDevice).toHaveBeenCalledWith(Networks.testnet, {
            id: 'testnet-device-id',
        })
        expect(result.current.data).toBeUndefined()
    })

    it('deletes only mainnet device when testnet is not registered', async () => {
        vi.mocked(useDeviceID).mockImplementation((network: string) => {
            if (network === 'mainnet') return 'mainnet-device-id'
            return null
        })

        vi.mocked(deleteDevice).mockResolvedValue(undefined)

        const { result } = renderHook(() => useDeleteDeviceMutation(), {
            wrapper: createWrapper(),
        })

        result.current.mutate()

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(deleteDevice).toHaveBeenCalledTimes(1)
        expect(deleteDevice).toHaveBeenCalledWith(Networks.mainnet, {
            id: 'mainnet-device-id',
        })
        expect(result.current.data).toBeUndefined()
    })

    it('accepts custom mutation options', async () => {
        vi.mocked(deleteDevice).mockResolvedValue(undefined)
        const onSuccess = vi.fn()

        const { result } = renderHook(
            () => useDeleteDeviceMutation({ onSuccess }),
            {
                wrapper: createWrapper(),
            },
        )

        result.current.mutate()

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(onSuccess).toHaveBeenCalled()
    })
})
