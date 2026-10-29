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
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDeleteDeviceMutation } from '../useDeleteDeviceMutation'
import { deleteDevice } from '../endpoints'
import { useDeviceStore } from '../../store'
import { useDeploymentDeviceID } from '../useDeviceID'

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
    useDeploymentDeviceID: vi.fn(),
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
                ['algorand/testnet', 'developer-device-id'],
                ['algorand/mainnet', 'live-device-id'],
            ]),
        }
        return selector(state as never)
    })
}

const mockDefaultDeviceID = () => {
    vi.mocked(useDeploymentDeviceID).mockImplementation(
        (deployment: string) => {
            if (deployment === 'developer') return 'developer-device-id'
            if (deployment === 'live') return 'live-device-id'
            return null
        },
    )
}

describe('useDeleteDeviceMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockDefaultDeviceStore()
        mockDefaultDeviceID()
    })

    it('deletes devices on both deployments when both are registered', async () => {
        vi.mocked(deleteDevice).mockResolvedValue(undefined)

        const { result } = renderHook(() => useDeleteDeviceMutation(), {
            wrapper: createWrapper(),
        })

        await act(() => result.current.mutateAsync())

        expect(deleteDevice).toHaveBeenCalledTimes(2)
        expect(deleteDevice).toHaveBeenCalledWith('developer', {
            id: 'developer-device-id',
        })
        expect(deleteDevice).toHaveBeenCalledWith('live', {
            id: 'live-device-id',
        })
    })

    it('returns undefined when no devices are registered', async () => {
        vi.mocked(useDeploymentDeviceID).mockReturnValue(null)

        const { result } = renderHook(() => useDeleteDeviceMutation(), {
            wrapper: createWrapper(),
        })

        await act(() => result.current.mutateAsync())

        expect(deleteDevice).not.toHaveBeenCalled()
    })

    it('deletes a deployment whose device id exists even without a push token', async () => {
        vi.mocked(useDeviceStore).mockImplementation(selector => {
            const state = {
                pushToken: null,
                deviceIDs: new Map([
                    ['algorand/testnet', 'developer-device-id'],
                    ['algorand/mainnet', 'live-device-id'],
                ]),
            }
            return selector(state as never)
        })
        vi.mocked(deleteDevice).mockResolvedValue(undefined)

        const { result } = renderHook(() => useDeleteDeviceMutation(), {
            wrapper: createWrapper(),
        })

        await act(() => result.current.mutateAsync())

        // v1 required both id and push token, so a device whose push
        // permission was never granted could not be deleted at all. v3
        // accepts `id` alone, so both deployments now get deleted properly.
        expect(deleteDevice).toHaveBeenCalledTimes(2)
        expect(deleteDevice).toHaveBeenCalledWith('developer', {
            id: 'developer-device-id',
        })
        expect(deleteDevice).toHaveBeenCalledWith('live', {
            id: 'live-device-id',
        })
    })

    it('handles API error', async () => {
        const mockError = new Error('Network error')
        vi.mocked(deleteDevice).mockRejectedValue(mockError)

        const { result } = renderHook(() => useDeleteDeviceMutation(), {
            wrapper: createWrapper(),
        })

        await act(async () => {
            await expect(result.current.mutateAsync()).rejects.toThrow(
                mockError,
            )
        })
    })

    it('deletes only the developer device when live is not registered', async () => {
        vi.mocked(useDeploymentDeviceID).mockImplementation(
            (deployment: string) => {
                if (deployment === 'developer') return 'developer-device-id'
                return null
            },
        )

        vi.mocked(deleteDevice).mockResolvedValue(undefined)

        const { result } = renderHook(() => useDeleteDeviceMutation(), {
            wrapper: createWrapper(),
        })

        await act(() => result.current.mutateAsync())

        expect(deleteDevice).toHaveBeenCalledTimes(1)
        expect(deleteDevice).toHaveBeenCalledWith('developer', {
            id: 'developer-device-id',
        })
    })

    it('deletes only the live device when developer is not registered', async () => {
        vi.mocked(useDeploymentDeviceID).mockImplementation(
            (deployment: string) => {
                if (deployment === 'live') return 'live-device-id'
                return null
            },
        )

        vi.mocked(deleteDevice).mockResolvedValue(undefined)

        const { result } = renderHook(() => useDeleteDeviceMutation(), {
            wrapper: createWrapper(),
        })

        await act(() => result.current.mutateAsync())

        expect(deleteDevice).toHaveBeenCalledTimes(1)
        expect(deleteDevice).toHaveBeenCalledWith('live', {
            id: 'live-device-id',
        })
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

        await act(() => result.current.mutateAsync())

        expect(onSuccess).toHaveBeenCalled()
    })

    it('deletes the devices it was called with when the ids change mid-request', async () => {
        vi.mocked(deleteDevice).mockResolvedValue(undefined)
        const { result, rerender } = renderHook(
            () => useDeleteDeviceMutation(),
            { wrapper: createWrapper() },
        )

        let deleted: Promise<void> | undefined
        act(() => {
            deleted = result.current.mutateAsync()
        })
        vi.mocked(useDeploymentDeviceID).mockReturnValue('other-device-id')
        rerender()
        await act(async () => {
            await deleted
        })

        expect(deleteDevice).toHaveBeenCalledTimes(2)
        expect(deleteDevice).toHaveBeenCalledWith('developer', {
            id: 'developer-device-id',
        })
        expect(deleteDevice).toHaveBeenCalledWith('live', {
            id: 'live-device-id',
        })
    })
})
