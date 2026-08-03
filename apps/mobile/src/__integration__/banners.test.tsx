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

// Banners and spot-banners, from server payload through mapper to domain shape.
// Covers: client-side dismissal hiding a banner with no server call;
// `auto_open_mode: 'force'` suppressing others AND overriding a prior local
// dismissal; and spot-banner dismissal hitting the close endpoint with an
// optimistic cache removal.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClientProvider } from '@tanstack/react-query'

import { server } from '@test-utils/msw-server'
import { createTestQueryClient } from '@test-utils/render'
import {
    mockBanners,
    mockSpotBanners,
} from '@perawallet/wallet-core-banners/test-handlers'
import {
    useBannersStore,
    useDismissSpotBannerMutation,
    useSpotBannersQuery,
    useVisibleBanners,
} from '@perawallet/wallet-core-banners'
import { useDeviceStore } from '@perawallet/wallet-core-device'

const SLOW_TEST_TIMEOUT_MS = 30_000
const DEVICE_ID = 'integration-test-device'
const NETWORK = 'mainnet' as const

const buildWrapper = () => {
    const queryClient = createTestQueryClient()
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

describe('Flow: Banners (regular)', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
    afterEach(() => {
        server.resetHandlers()
        // Reset client-side dismissals so each test starts clean.
        act(() => {
            useBannersStore.getState().resetState()
        })
    })
    afterAll(() => server.close())

    beforeEach(() => {
        // The hooks gate fetches on a device ID being present for the
        // active network. In a real session this is set by the device-
        // registration flow.
        useDeviceStore.getState().setDeviceID(NETWORK, DEVICE_ID)
    })

    it(
        'Given the server returns three banners of mixed types, when useVisibleBanners resolves, then all three round-trip with type / title / subtitle / CTA mapped to camelCase',
        async () => {
            server.use(
                mockBanners({
                    deviceID: DEVICE_ID,
                    response: {
                        count: 3,
                        results: [
                            {
                                id: 1,
                                type: 'governance',
                                title: 'Vote in Period 12',
                                subtitle: 'Voting closes May 30',
                                button_label: 'Vote now',
                                button_url: 'pera://governance',
                                is_button_url_external: false,
                            },
                            {
                                id: 2,
                                type: 'staking',
                                title: 'Earn yield on ALGO',
                                subtitle: null,
                                button_label: 'Start',
                                button_url: 'pera://staking',
                                is_button_url_external: false,
                            },
                            {
                                id: 3,
                                type: 'card',
                                title: 'Get a Web3 Mastercard',
                                subtitle: null,
                                button_label: null,
                                button_url: null,
                                is_button_url_external: false,
                            },
                        ],
                    },
                }),
            )

            const { result } = renderHook(() => useVisibleBanners(), {
                wrapper: buildWrapper(),
            })

            await waitFor(
                () => expect(result.current.banners).toHaveLength(3),
                { timeout: 5000 },
            )

            const byId = new Map(result.current.banners.map(b => [b.id, b]))
            expect(byId.get('1')?.type).toBe('governance')
            expect(byId.get('1')?.title).toBe('Vote in Period 12')
            expect(byId.get('1')?.buttonLabel).toBe('Vote now')
            expect(byId.get('1')?.buttonUrl).toBe('pera://governance')
            expect(byId.get('1')?.isButtonUrlExternal).toBe(false)
            expect(byId.get('2')?.subtitle).toBeNull()
            // No forced banner → forcedBanner is null.
            expect(result.current.forcedBanner).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a server payload with two regular banners, when the user dismisses one via the store, then useVisibleBanners filters that banner out without re-fetching',
        async () => {
            server.use(
                mockBanners({
                    deviceID: DEVICE_ID,
                    response: {
                        count: 2,
                        results: [
                            {
                                id: 10,
                                type: 'generic',
                                title: 'Welcome',
                                is_button_url_external: false,
                            },
                            {
                                id: 11,
                                type: 'generic',
                                title: 'Tip of the day',
                                is_button_url_external: false,
                            },
                        ],
                    },
                }),
            )

            const { result } = renderHook(() => useVisibleBanners(), {
                wrapper: buildWrapper(),
            })

            await waitFor(
                () => expect(result.current.banners).toHaveLength(2),
                { timeout: 5000 },
            )

            // Client-side dismissal — no server call required for
            // regular banners. Store action triggers re-derive of the
            // visible set.
            act(() => {
                useBannersStore.getState().dismissBanner('10')
            })

            await waitFor(() => {
                expect(result.current.banners.map(b => b.id)).toEqual(['11'])
            })
            expect(result.current.totalCount).toBe(1)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a server payload that includes a forced banner alongside regular banners, when useVisibleBanners resolves, then ONLY the forced banner is returned and it bypasses any client-side dismissal',
        async () => {
            server.use(
                mockBanners({
                    deviceID: DEVICE_ID,
                    response: {
                        count: 2,
                        results: [
                            {
                                id: 20,
                                type: 'generic',
                                title: 'Regular banner',
                                is_button_url_external: false,
                            },
                            {
                                id: 21,
                                type: 'generic',
                                title: 'Critical security update',
                                subtitle: 'Action required',
                                button_label: 'Update now',
                                button_url: 'pera://update',
                                is_button_url_external: false,
                                auto_open_mode: 'force',
                            },
                        ],
                    },
                }),
            )

            // Pre-dismiss the forced banner to prove that force-mode
            // bypasses the dismissal filter (so a "security" banner
            // can't be silenced by a prior dismissal of an id-aliased
            // earlier banner).
            act(() => {
                useBannersStore.getState().dismissBanner('21')
            })

            const { result } = renderHook(() => useVisibleBanners(), {
                wrapper: buildWrapper(),
            })

            await waitFor(
                () => {
                    expect(result.current.banners).toHaveLength(1)
                    expect(result.current.banners[0].id).toBe('21')
                },
                { timeout: 5000 },
            )

            expect(result.current.forcedBanner?.id).toBe('21')
            expect(result.current.forcedBanner?.autoOpenMode).toBe('force')
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the server returns banners missing all renderable text fields, when useBannersQuery resolves, then those banners are filtered out (nothing to render)',
        async () => {
            server.use(
                mockBanners({
                    deviceID: DEVICE_ID,
                    response: {
                        count: 2,
                        results: [
                            // No title / subtitle / button_label —
                            // mapper drops these so the UI never tries
                            // to render an empty card.
                            {
                                id: 30,
                                type: 'generic',
                                is_button_url_external: false,
                            },
                            {
                                id: 31,
                                type: 'card',
                                title: 'Cards',
                                is_button_url_external: false,
                            },
                        ],
                    },
                }),
            )

            const { result } = renderHook(() => useVisibleBanners(), {
                wrapper: buildWrapper(),
            })

            await waitFor(
                () => expect(result.current.banners).toHaveLength(1),
                { timeout: 5000 },
            )
            expect(result.current.banners[0].id).toBe('31')
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})

describe('Flow: Spot banners', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    beforeEach(() => {
        useDeviceStore.getState().setDeviceID(NETWORK, DEVICE_ID)
    })

    it(
        'Given the server returns spot banners, when useSpotBannersQuery resolves, then API fields map to the SpotBanner domain shape (image→imageUrl, button_url_is_external→isUrlExternal)',
        async () => {
            server.use(
                mockSpotBanners({
                    deviceID: DEVICE_ID,
                    response: [
                        {
                            id: 100,
                            text: 'Try staking',
                            image: 'https://cdn.pera.test/icons/stake.png',
                            url: 'pera://staking',
                            button_url_is_external: false,
                        },
                        {
                            id: 101,
                            text: 'Check out the blog',
                            image: 'https://cdn.pera.test/icons/blog.png',
                            url: 'https://pera.app/blog',
                            button_url_is_external: true,
                        },
                    ],
                }),
            )

            const { result } = renderHook(() => useSpotBannersQuery(), {
                wrapper: buildWrapper(),
            })

            await waitFor(
                () => expect(result.current.spotBanners).toHaveLength(2),
                { timeout: 5000 },
            )

            const byId = new Map(result.current.spotBanners.map(b => [b.id, b]))
            expect(byId.get('100')?.text).toBe('Try staking')
            expect(byId.get('100')?.imageUrl).toBe(
                'https://cdn.pera.test/icons/stake.png',
            )
            expect(byId.get('100')?.isUrlExternal).toBe(false)
            expect(byId.get('101')?.isUrlExternal).toBe(true)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a spot banner is visible, when the dismiss mutation runs, then the close endpoint is called and the next GET excludes the banner',
        async () => {
            const SPOT_ID = '42'
            const KEEP_ID = '43'
            // Stateful mock: the close PATCH records the id and the GET
            // filters it out. Mirrors real backend behaviour where the
            // device's `closed_spot_banner_ids` array is what gates the
            // subsequent reads.
            const closedIds = new Set<string>()
            const ALL_BANNERS = [
                {
                    id: SPOT_ID,
                    text: 'Dismiss me',
                    image: 'https://cdn.pera.test/icons/x.png',
                    url: 'pera://x',
                    button_url_is_external: false,
                },
                {
                    id: KEEP_ID,
                    text: 'Keep me',
                    image: 'https://cdn.pera.test/icons/y.png',
                    url: 'pera://y',
                    button_url_is_external: false,
                },
            ]
            const closeRequests: string[] = []
            server.use(
                http.get(`*/v1/devices/${DEVICE_ID}/spot-banners/`, () =>
                    HttpResponse.json(
                        ALL_BANNERS.filter(b => !closedIds.has(b.id)),
                    ),
                ),
                http.patch(
                    `*/v1/devices/${DEVICE_ID}/spot-banners/:spotId/close/`,
                    ({ params }) => {
                        const id = String(params.spotId)
                        closedIds.add(id)
                        closeRequests.push(id)
                        return new HttpResponse(null, { status: 204 })
                    },
                ),
            )

            const wrapper = buildWrapper()
            const { result } = renderHook(
                () => ({
                    list: useSpotBannersQuery(),
                    dismiss: useDismissSpotBannerMutation(),
                }),
                { wrapper },
            )

            await waitFor(
                () => expect(result.current.list.spotBanners).toHaveLength(2),
                { timeout: 5000 },
            )

            act(() => {
                result.current.dismiss.mutate(SPOT_ID)
            })

            // After the PATCH lands and the mutation invalidates the
            // query, the refetch returns only `KEEP_ID` because the
            // stateful server has marked `SPOT_ID` as closed.
            await waitFor(() => {
                expect(result.current.list.spotBanners.map(b => b.id)).toEqual([
                    KEEP_ID,
                ])
            })

            // The PATCH fired — server-side dismissal is what keeps the
            // banner gone across sessions.
            expect(closeRequests).toEqual([SPOT_ID])
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the close endpoint returns an error, when the dismiss mutation finishes, then the optimistic removal is rolled back so the user sees the banner again',
        async () => {
            const SPOT_ID = '50'
            server.use(
                mockSpotBanners({
                    deviceID: DEVICE_ID,
                    response: [
                        {
                            id: SPOT_ID,
                            text: 'Server will reject the close',
                            image: 'https://cdn.pera.test/icons/x.png',
                            url: 'pera://x',
                            button_url_is_external: false,
                        },
                    ],
                }),
                http.patch(
                    `*/v1/devices/${DEVICE_ID}/spot-banners/${SPOT_ID}/close/`,
                    () => new HttpResponse(null, { status: 500 }),
                ),
            )

            // Silence the expected network error log so it doesn't
            // clutter test output.
            vi.spyOn(console, 'error').mockImplementation(() => undefined)

            const wrapper = buildWrapper()
            const { result } = renderHook(
                () => ({
                    list: useSpotBannersQuery(),
                    dismiss: useDismissSpotBannerMutation(),
                }),
                { wrapper },
            )

            await waitFor(
                () => expect(result.current.list.spotBanners).toHaveLength(1),
                { timeout: 5000 },
            )

            act(() => {
                result.current.dismiss.mutate(SPOT_ID)
            })

            // Optimistic removal flickers in: the banner disappears, the
            // PATCH fails, then `onError` rolls back to the previous
            // cache state. We assert the rollback outcome.
            await waitFor(() => {
                expect(result.current.dismiss.isPending).toBe(false)
            })
            await waitFor(() => {
                expect(result.current.list.spotBanners.map(b => b.id)).toEqual([
                    SPOT_ID,
                ])
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
