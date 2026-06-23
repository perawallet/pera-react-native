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

import { describe, expect, it, vi, beforeEach } from 'vitest'

const signedBackupRequestMock = vi.fn()
vi.mock('../signedRequest', () => ({
    signedBackupRequest: (...args: unknown[]) =>
        signedBackupRequestMock(...args),
}))

import { fetchDelta } from '../endpoints'

describe('fetchDelta', () => {
    beforeEach(() => signedBackupRequestMock.mockReset())

    it('unwraps the entries array from the delta response', async () => {
        signedBackupRequestMock.mockResolvedValue({
            entries: [
                {
                    seq: 5,
                    key: 'accounts/ADDR',
                    type: 'ACCOUNT',
                    ver: 1,
                    status: 'ACTIVE',
                    op: 'UPSERT',
                    hash: 'sha256:abc',
                },
            ],
        })

        const result = await fetchDelta(
            'mainnet',
            'did:pera:ADDR',
            'device-1',
            0,
        )

        expect(result).toEqual([
            {
                seq: 5,
                key: 'accounts/ADDR',
                type: 'ACCOUNT',
                ver: 1,
                status: 'ACTIVE',
                op: 'UPSERT',
                hash: 'sha256:abc',
            },
        ])
    })

    it('returns an empty array when the response has no entries', async () => {
        signedBackupRequestMock.mockResolvedValue({})

        const result = await fetchDelta(
            'mainnet',
            'did:pera:ADDR',
            'device-1',
            0,
        )

        expect(result).toEqual([])
    })
})
