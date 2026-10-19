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

import { beforeEach, describe, expect, test, vi } from 'vitest'

const queryClientMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        queryClient: queryClientMock,
    }
})

import { fetchAssetGroups } from '../endpoints'

describe('groups endpoints', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    test('fetchAssetGroups reads the groups list from the deployment', async () => {
        queryClientMock.mockResolvedValue({ data: { results: [] } })

        const response = await fetchAssetGroups('live')

        expect(response).toEqual({ results: [] })
        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                backend: 'pera',
                deployment: 'live',
                method: 'GET',
                url: '/v1/assets/groups/',
            }),
        )
    })

    test('rejects a malformed response', async () => {
        queryClientMock.mockResolvedValue({ data: { results: [{ id: 1 }] } })

        await expect(fetchAssetGroups('live')).rejects.toThrow()
    })
})
