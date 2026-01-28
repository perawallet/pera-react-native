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
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '../../../test-utils'
import { useDeleteDeviceMutation } from '../useDeleteDeviceMutation'
import { deleteDevice } from '../endpoints'
import { Networks } from '@perawallet/wallet-core-shared'
import { useDeviceStore } from '../../store'
import { useDeviceID } from '../useDevice'
import { DevicePlatforms } from '../../models'

vi.mock('../endpoints', () => ({
    deleteDevice: vi.fn(),
}))

vi.mock('../../store', () => ({
    useDeviceStore: vi.fn(),
}))

vi.mock('../useDevice', () => ({
    useDeviceID: vi.fn(),
}))

vi.mock('../useDeviceInfoService', () => ({
    useDeviceInfoService: vi.fn(() => ({
        getDevicePlatform: vi.fn().mockReturnValue('ios'),
    })),
}))

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
        const mockResponse = { id: 'device-id', platform: DevicePlatforms.ios }
        vi.mocked(deleteDevice).mockResolvedValue(mockResponse)

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
            push_token: 'test-push-token',
            platform: 'ios',
            accounts: [],
        })
        expect(deleteDevice).toHaveBeenCalledWith(Networks.mainnet, {
            id: 'mainnet-device-id',
            push_token: 'test-push-token',
            platform: 'ios',
            accounts: [],
        })
        expect(result.current.data).toHaveLength(2)
    })

    it('returns empty array when no devices are registered', async () => {
        vi.mocked(useDeviceID).mockReturnValue(null)

        const { result } = renderHook(() => useDeleteDeviceMutation(), {
            wrapper: createWrapper(),
        })

        result.current.mutate()

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(deleteDevice).not.toHaveBeenCalled()
        expect(result.current.data).toEqual([])
    })

    it('returns empty array when no push token is available', async () => {
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

        const { result } = renderHook(() => useDeleteDeviceMutation(), {
            wrapper: createWrapper(),
        })

        result.current.mutate()

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(deleteDevice).not.toHaveBeenCalled()
        expect(result.current.data).toEqual([])
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

        const mockResponse = { id: 'device-id', platform: DevicePlatforms.ios }
        vi.mocked(deleteDevice).mockResolvedValue(mockResponse)

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
            push_token: 'test-push-token',
            platform: 'ios',
            accounts: [],
        })
        expect(result.current.data).toHaveLength(1)
    })

    it('deletes only mainnet device when testnet is not registered', async () => {
        vi.mocked(useDeviceID).mockImplementation((network: string) => {
            if (network === 'mainnet') return 'mainnet-device-id'
            return null
        })

        const mockResponse = { id: 'device-id', platform: DevicePlatforms.ios }
        vi.mocked(deleteDevice).mockResolvedValue(mockResponse)

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
            push_token: 'test-push-token',
            platform: 'ios',
            accounts: [],
        })
        expect(result.current.data).toHaveLength(1)
    })

    it('accepts custom mutation options', async () => {
        const mockResponse = { id: 'device-id', platform: DevicePlatforms.ios }
        vi.mocked(deleteDevice).mockResolvedValue(mockResponse)
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
