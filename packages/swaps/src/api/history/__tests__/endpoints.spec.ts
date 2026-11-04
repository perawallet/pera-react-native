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
import { fetchSwapHistory } from '../endpoints'
import { routerOrderItem, SCOPE_A } from '../../__tests__/routerFixtures'

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    queryClient: vi.fn(),
}))

describe('fetchSwapHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('asks for the device and accounts and reads the next cursor', async () => {
        ;(queryClient as Mock).mockResolvedValue({
            data: {
                next: 'https://x/api/v4/swap/history/?cursor=n2',
                results: [routerOrderItem()],
            },
        })

        const page = await fetchSwapHistory(
            { deviceId: 'dev-1', accounts: ['fake-a:main:A', 'fake-a:main:B'] },
            SCOPE_A,
        )

        expect(queryClient).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                url: '/api/v4/swap/history/',
                params: {
                    device_id: 'dev-1',
                    accounts: 'fake-a:main:A,fake-a:main:B',
                },
            }),
        )
        expect(page.results).toHaveLength(1)
        expect(page.next).toBe('n2')
    })
})
