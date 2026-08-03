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

// Asset discovery: AddAssetView -> debounce -> useAssetSearchQuery ->
// GET /v1/assets/search/. Covers all three verification tiers round-tripping,
// cursor pagination via the `next` URL, and the `enabled` gate that keeps empty
// queries from firing.

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'

import { server } from '@test-utils/msw-server'
import { createTestQueryClient } from '@test-utils/render'
import { mockAssetSearch } from '@perawallet/wallet-core-assets/test-handlers'
import { useAssetSearchQuery } from '@perawallet/wallet-core-assets'

const SLOW_TEST_TIMEOUT_MS = 30_000

const buildWrapper = () => {
    const queryClient = createTestQueryClient()
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

describe('Flow: Asset discovery (search)', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
    afterEach(() => server.resetHandlers())
    afterAll(() => server.close())

    it(
        'Given the search endpoint returns mixed-tier results, when the hook resolves, then all three verification tiers (verified, unverified, suspicious) round-trip onto the results so the UI can decorate them',
        async () => {
            // Three results — one of each verification tier. The user
            // sees them all in the search dropdown, and the UI uses the
            // tier to render verified-badge / neutral / warning icons
            // for each row.
            server.use(
                mockAssetSearch({
                    response: {
                        results: [
                            {
                                asset_id: 31_566_704,
                                name: 'USD Coin',
                                unit_name: 'USDC',
                                verification_tier: 'verified',
                                usd_value: '1.00',
                                type: 'standard_asset',
                            },
                            {
                                asset_id: 12_345,
                                name: 'Random Token',
                                unit_name: 'RND',
                                verification_tier: 'unverified',
                                usd_value: null,
                                type: 'standard_asset',
                            },
                            {
                                asset_id: 99_999,
                                name: 'Suspicious Coin',
                                unit_name: 'SCAM',
                                verification_tier: 'suspicious',
                                usd_value: null,
                                type: 'standard_asset',
                            },
                        ],
                        next: null,
                        previous: null,
                    },
                }),
            )

            const { result } = renderHook(() => useAssetSearchQuery('coin'), {
                wrapper: buildWrapper(),
            })

            await waitFor(
                () => {
                    expect(result.current.isLoading).toBe(false)
                    expect(result.current.results).toHaveLength(3)
                },
                { timeout: 5000 },
            )

            // Each tier propagates to the consumer (the UI's row
            // renderer reads `verificationTier` to decide which icon
            // to show). The transform from API `verification_tier` to
            // domain `verificationTier` is what we're proving end-to-end.
            const byId = new Map(
                result.current.results.map(r => [r.assetId, r]),
            )
            expect(byId.get('31566704')?.peraMetadata?.verificationTier).toBe(
                'verified',
            )
            expect(byId.get('12345')?.peraMetadata?.verificationTier).toBe(
                'unverified',
            )
            expect(byId.get('99999')?.peraMetadata?.verificationTier).toBe(
                'suspicious',
            )

            // Identity fields survive the snake_case → camelCase
            // mapping. unitName is what the AddAssetView displays as
            // the secondary label.
            expect(byId.get('31566704')?.name).toBe('USD Coin')
            expect(byId.get('31566704')?.unitName).toBe('USDC')

            // Single-page response — `hasNextPage` should be false.
            expect(result.current.hasNextPage).toBe(false)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a paged search response (next cursor URL present), when the consumer triggers fetchNextPage, then the second page loads and merges with the first',
        async () => {
            const cursor = 'page-2-token'
            // First call returns the cursor URL; subsequent calls are
            // matched by the same handler. We swap handlers at runtime
            // so the second call returns a different page. MSW handlers
            // resolve in registration order — the most recent
            // `server.use(...)` wins for matching requests.
            let callCount = 0
            const dynamicResponse = (req: Request) => {
                callCount++
                const url = new URL(req.url)
                const isPageTwo = url.searchParams.get('cursor') === cursor
                if (isPageTwo) {
                    return {
                        results: [
                            {
                                asset_id: 222,
                                name: 'Page 2 Asset',
                                unit_name: 'P2',
                                verification_tier: 'verified' as const,
                                type: 'standard_asset' as const,
                            },
                        ],
                        next: null,
                        previous: null,
                    }
                }
                return {
                    results: [
                        {
                            asset_id: 111,
                            name: 'Page 1 Asset',
                            unit_name: 'P1',
                            verification_tier: 'verified' as const,
                            type: 'standard_asset' as const,
                        },
                    ],
                    next: `https://api.pera.test/v1/assets/search/?cursor=${cursor}`,
                    previous: null,
                }
            }
            // Register a custom handler that delegates to the dynamic
            // builder above. We bypass the validated `mockAssetSearch`
            // helper here because the response shape changes per call.
            server.use(
                (await import('msw')).http.get(
                    '*/v1/assets/search/',
                    async ({ request }) =>
                        (await import('msw')).HttpResponse.json(
                            dynamicResponse(request),
                        ),
                ),
            )

            const { result } = renderHook(() => useAssetSearchQuery('asset'), {
                wrapper: buildWrapper(),
            })

            // First page resolves, hasNextPage is true because the
            // server returned a `next` URL.
            await waitFor(
                () => {
                    expect(result.current.results).toHaveLength(1)
                    expect(result.current.hasNextPage).toBe(true)
                },
                { timeout: 5000 },
            )
            expect(result.current.results[0].assetId).toBe('111')

            // Trigger pagination — the hook extracts the cursor from
            // the `next` URL and passes it as a query param. The mock
            // dispatcher returns page 2 when it sees the cursor.
            act(() => {
                result.current.fetchNextPage()
            })

            await waitFor(
                () => {
                    expect(result.current.results).toHaveLength(2)
                },
                { timeout: 5000 },
            )
            // Both pages are merged in order — page 1 then page 2.
            expect(result.current.results.map(r => r.assetId)).toEqual([
                '111',
                '222',
            ])
            // hasNextPage flips off because page 2's `next` is null.
            expect(result.current.hasNextPage).toBe(false)
            // Two requests: one per page.
            expect(callCount).toBeGreaterThanOrEqual(2)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the consumer disables the search (enabled: false), when the hook mounts, then no request fires and results stay empty',
        async () => {
            // No server.use — if the hook fired the request, MSW would
            // log an unhandled-request warning (we set bypass globally,
            // but the assertion is on results being empty). Disabling
            // the query is the gate the AddAssetView uses while the
            // search input is empty.
            const { result } = renderHook(
                () => useAssetSearchQuery('', { enabled: false }),
                { wrapper: buildWrapper() },
            )

            // Give react-query a tick — if it were going to fire, it
            // would by now.
            await new Promise(resolve => setTimeout(resolve, 100))

            expect(result.current.results).toEqual([])
            expect(result.current.isLoading).toBe(false)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
