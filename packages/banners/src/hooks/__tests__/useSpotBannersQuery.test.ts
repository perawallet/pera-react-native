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
import { createWrapper } from '@perawallet/wallet-extension-platform'
import { useSpotBannersQuery } from '../useSpotBannersQuery'
import { fetchSpotBanners } from '../../api/spot-banners'

vi.mock('../../api/spot-banners', () => ({
    fetchSpotBanners: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: vi.fn().mockReturnValue('device-1'),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn().mockReturnValue({ network: 'mainnet' }),
}))

beforeEach(() => {
    vi.clearAllMocks()
})

describe('useSpotBannersQuery', () => {
    it('maps server response into SpotBanner domain objects', async () => {
        vi.mocked(fetchSpotBanners).mockResolvedValue([
            {
                id: 1,
                text: 'Hi',
                image: 'https://cdn.test/x.png',
                url: 'pera://x',
                button_url_is_external: false,
            },
        ])

        const { result } = renderHook(() => useSpotBannersQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.spotBanners).toEqual([
            {
                id: 1,
                text: 'Hi',
                imageUrl: 'https://cdn.test/x.png',
                url: 'pera://x',
                isUrlExternal: false,
            },
        ])
    })

    it('returns an empty array on error', async () => {
        vi.mocked(fetchSpotBanners).mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() => useSpotBannersQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.spotBanners).toEqual([])
    })
})
