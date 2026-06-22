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

const mockQueryClient = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')
    return {
        ...actual,
        queryClient: mockQueryClient,
    }
})

const { fetchPeraWebBackup } = await import('../endpoints')

describe('fetchPeraWebBackup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockQueryClient.mockResolvedValue({ data: { id: 'x' } })
    })

    const urlFor = async (backupId: string): Promise<string> => {
        await fetchPeraWebBackup('mainnet', backupId)
        return mockQueryClient.mock.calls[0][0].url
    }

    it('passes a normal id through unchanged', async () => {
        expect(await urlFor('fixture-backup-id')).toBe(
            '/v1/backups/fixture-backup-id/',
        )
    })

    it('encodes path-traversal metacharacters so the request cannot be retargeted', async () => {
        expect(await urlFor('../admin')).toBe('/v1/backups/..%2Fadmin/')
    })

    it('encodes query and fragment metacharacters', async () => {
        expect(await urlFor('id?x=1#frag')).toBe(
            '/v1/backups/id%3Fx%3D1%23frag/',
        )
    })
})
