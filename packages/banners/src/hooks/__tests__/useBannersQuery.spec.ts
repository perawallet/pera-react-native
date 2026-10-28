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
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@perawallet/wallet-extension-platform/test-utils'
import { useDeploymentDeviceID } from '@perawallet/wallet-core-device'
import { useBannersQuery } from '../useBannersQuery'
import { fetchBanners } from '../../api/banners'

vi.mock('../../api/banners', () => ({
    fetchBanners: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeploymentDeviceID: vi.fn().mockReturnValue('test-device-id'),
}))

const network = vi.hoisted(() => ({ mode: 'live' }))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useWalletDeployment: () => network.mode,
}))

beforeEach(() => {
    vi.clearAllMocks()
    network.mode = 'live'
    vi.mocked(useDeploymentDeviceID).mockReturnValue('test-device-id')
})

describe('useBannersQuery', () => {
    it.each(['live', 'developer'])(
        'maps server response into Banner domain objects for the %s deployment',
        async deployment => {
            network.mode = deployment
            vi.mocked(fetchBanners).mockResolvedValue({
                count: 1,
                results: [
                    {
                        id: 1,
                        type: 'governance',
                        title: 'Vote',
                        subtitle: 'Now',
                        button_label: 'Go',
                        button_url: 'pera://gov',
                        is_button_url_external: false,
                    },
                ],
            })

            const { result } = renderHook(() => useBannersQuery(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isLoading).toBe(false))

            expect(useDeploymentDeviceID).toHaveBeenCalledWith(deployment)
            expect(fetchBanners).toHaveBeenCalledWith(
                deployment,
                'test-device-id',
            )
            expect(result.current.banners).toEqual([
                {
                    id: 1,
                    type: 'governance',
                    title: 'Vote',
                    subtitle: 'Now',
                    buttonLabel: 'Go',
                    buttonUrl: 'pera://gov',
                    isButtonUrlExternal: false,
                    autoOpenMode: null,
                    backgroundImageUrl: null,
                },
            ])
        },
    )

    it('filters out banners with no renderable content', async () => {
        vi.mocked(fetchBanners).mockResolvedValue({
            count: 2,
            results: [
                {
                    id: 1,
                    type: 'generic',
                    title: 'Has title',
                    is_button_url_external: false,
                },
                {
                    id: 2,
                    type: 'generic',
                    title: null,
                    subtitle: null,
                    button_label: null,
                    is_button_url_external: false,
                },
            ],
        })

        const { result } = renderHook(() => useBannersQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.banners).toHaveLength(1)
        expect(result.current.banners[0].id).toBe(1)
    })

    it('returns an empty array on error', async () => {
        vi.mocked(fetchBanners).mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() => useBannersQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.banners).toEqual([])
    })

    it('stays disabled and returns empty when deviceID is null', () => {
        vi.mocked(useDeploymentDeviceID).mockReturnValue(null)

        const { result } = renderHook(() => useBannersQuery(), {
            wrapper: createWrapper(),
        })

        expect(fetchBanners).not.toHaveBeenCalled()
        expect(result.current.banners).toEqual([])
        expect(result.current.isLoading).toBe(false)
    })
})
