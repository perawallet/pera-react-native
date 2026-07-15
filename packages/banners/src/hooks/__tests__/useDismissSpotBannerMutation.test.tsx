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
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { closeSpotBanner } from '../../api/spot-banners'
import { useDismissSpotBannerMutation } from '../useDismissSpotBannerMutation'
import { getSpotBannersQueryKey } from '../querykeys'
import { useDeviceID } from '@perawallet/wallet-core-device'
import type { ReactNode } from 'react'

vi.mock('../../api/spot-banners', () => ({
    closeSpotBanner: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: vi.fn().mockReturnValue('dev-1'),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn().mockReturnValue({ network: 'mainnet' }),
}))

const buildWrapper = (qc: QueryClient) => {
    const Wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    )
    return Wrapper
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useDeviceID).mockReturnValue('dev-1')
})

describe('useDismissSpotBannerMutation', () => {
    it('optimistically removes banner from cache before request resolves', async () => {
        const qc = new QueryClient({
            defaultOptions: { mutations: { retry: false } },
        })
        const key = getSpotBannersQueryKey('mainnet', 'dev-1')
        qc.setQueryData(key, [
            { id: 1, text: 'a', image: 'x', url: 'y' },
            { id: 2, text: 'b', image: 'x', url: 'y' },
        ])

        let resolveClose: () => void = () => undefined
        vi.mocked(closeSpotBanner).mockImplementation(
            () => new Promise<void>(resolve => (resolveClose = resolve)),
        )

        const { result } = renderHook(() => useDismissSpotBannerMutation(), {
            wrapper: buildWrapper(qc),
        })

        act(() => result.current.mutate(1))

        await waitFor(() => {
            expect(qc.getQueryData<unknown[]>(key)).toHaveLength(1)
        })

        resolveClose()
        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(closeSpotBanner).toHaveBeenCalledWith('mainnet', 'dev-1', 1)
    })

    it('rolls back on server error', async () => {
        const qc = new QueryClient({
            defaultOptions: { mutations: { retry: false } },
        })
        const key = getSpotBannersQueryKey('mainnet', 'dev-1')
        const initial = [
            { id: 1, text: 'a', image: 'x', url: 'y' },
            { id: 2, text: 'b', image: 'x', url: 'y' },
        ]
        qc.setQueryData(key, initial)

        vi.mocked(closeSpotBanner).mockRejectedValue(new Error('nope'))

        const { result } = renderHook(() => useDismissSpotBannerMutation(), {
            wrapper: buildWrapper(qc),
        })

        act(() => result.current.mutate(1))

        await waitFor(() => expect(result.current.isPending).toBe(false))
        // After rollback the cache should match the initial value (length 2)
        expect(qc.getQueryData<unknown[]>(key)).toHaveLength(2)
    })

    it('runs without crashing when the cache is empty (no optimistic update)', async () => {
        const qc = new QueryClient({
            defaultOptions: { mutations: { retry: false } },
        })
        vi.mocked(closeSpotBanner).mockResolvedValue(undefined)

        const { result } = renderHook(() => useDismissSpotBannerMutation(), {
            wrapper: buildWrapper(qc),
        })

        act(() => result.current.mutate(7))
        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(closeSpotBanner).toHaveBeenCalledWith('mainnet', 'dev-1', 7)
    })

    it('does not crash on error when the cache was empty (nothing to roll back)', async () => {
        const qc = new QueryClient({
            defaultOptions: { mutations: { retry: false } },
        })
        vi.mocked(closeSpotBanner).mockRejectedValue(new Error('nope'))

        const { result } = renderHook(() => useDismissSpotBannerMutation(), {
            wrapper: buildWrapper(qc),
        })

        act(() => result.current.mutate(7))
        await waitFor(() => expect(result.current.isPending).toBe(false))

        const key = getSpotBannersQueryKey('mainnet', 'dev-1')
        expect(qc.getQueryData(key)).toBeUndefined()
    })

    it('uses an empty deviceID when useDeviceID returns null', async () => {
        vi.mocked(useDeviceID).mockReturnValue(null)

        const qc = new QueryClient({
            defaultOptions: { mutations: { retry: false } },
        })
        vi.mocked(closeSpotBanner).mockResolvedValue(undefined)

        const { result } = renderHook(() => useDismissSpotBannerMutation(), {
            wrapper: buildWrapper(qc),
        })

        act(() => result.current.mutate(1))
        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(closeSpotBanner).toHaveBeenCalledWith('mainnet', '', 1)
    })
})
