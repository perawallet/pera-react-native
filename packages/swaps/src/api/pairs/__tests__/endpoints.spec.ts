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

import { beforeEach, describe, expect, test, vi, type Mock } from 'vitest'
import { queryClient } from '@perawallet/wallet-core-shared'
import { fetchSwapPairs } from '../endpoints'
import { routerAsset, SCOPE_A } from '../../__tests__/routerFixtures'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    queryClient: vi.fn(),
}))

const anchor = { ...SCOPE_A, assetId: 'native' }

describe('fetchSwapPairs', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('asks for signable pairs from the anchor', async () => {
        ;(queryClient as Mock).mockResolvedValue({ data: { results: [] } })

        await fetchSwapPairs({
            anchor,
            direction: 'source',
            q: 'usd',
            cursor: 'c2',
        })

        expect(queryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                url: '/api/v4/swap/pairs/',
                params: {
                    source: 'fake-a:main/token:native',
                    signable: 'true',
                    q: 'usd',
                    cursor: 'c2',
                },
            }),
        )
    })

    test('reads the next cursor from a page URL or a bare cursor', async () => {
        ;(queryClient as Mock)
            .mockResolvedValueOnce({
                data: {
                    next: 'https://x/api/v4/swap/pairs/?cursor=abc',
                    results: [
                        { kind: 'token', asset: routerAsset(SCOPE_A, '1') },
                    ],
                },
            })
            .mockResolvedValueOnce({ data: { next: 'def', results: [] } })

        const first = await fetchSwapPairs({ anchor, direction: 'source' })
        const second = await fetchSwapPairs({ anchor, direction: 'source' })

        expect(first.next).toBe('abc')
        expect(first.assets).toHaveLength(1)
        expect(second.next).toBe('def')
    })
})
