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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveVerifiedNameAddress } from '../resolveVerifiedNameAddress'

const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

const mockFetchNameSearch = vi.hoisted(() => vi.fn())
const mockVerifyNameAddress = vi.hoisted(() => vi.fn())

vi.mock('../../api', () => ({ fetchNameSearch: mockFetchNameSearch }))
vi.mock('../verifyNameAddress', () => ({
    verifyNameAddress: mockVerifyNameAddress,
}))

const MATCH = {
    name: 'alice.eth',
    address: '0xabc',
    service: { name: 'ENS', logo: '' },
}

describe('resolveVerifiedNameAddress', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns the backend address once the on-chain check verifies it', async () => {
        mockFetchNameSearch.mockResolvedValue([MATCH])
        mockVerifyNameAddress.mockResolvedValue('verified')
        const { signal } = new AbortController()

        await expect(
            resolveVerifiedNameAddress({
                name: 'alice.eth',
                scope: SCOPE,
                signal,
            }),
        ).resolves.toEqual({ status: 'verified', address: '0xabc' })
        expect(mockVerifyNameAddress).toHaveBeenCalledWith({
            name: 'alice.eth',
            address: '0xabc',
            scope: SCOPE,
            signal,
        })
    })

    it('is not-found when the search has no result, without verifying', async () => {
        mockFetchNameSearch.mockResolvedValue([])

        await expect(
            resolveVerifiedNameAddress({ name: 'alice.eth', scope: SCOPE }),
        ).resolves.toEqual({ status: 'not-found' })
        expect(mockVerifyNameAddress).not.toHaveBeenCalled()
    })

    it('is unavailable when the search fails', async () => {
        mockFetchNameSearch.mockRejectedValue(new Error('503'))

        await expect(
            resolveVerifiedNameAddress({ name: 'alice.eth', scope: SCOPE }),
        ).resolves.toEqual({ status: 'unavailable' })
    })

    it.each(['mismatch', 'unavailable'] as const)(
        'passes a %s verdict through',
        async verdict => {
            mockFetchNameSearch.mockResolvedValue([MATCH])
            mockVerifyNameAddress.mockResolvedValue(verdict)

            await expect(
                resolveVerifiedNameAddress({ name: 'alice.eth', scope: SCOPE }),
            ).resolves.toEqual({ status: verdict })
        },
    )

    it('rethrows an abort', async () => {
        const abort = Object.assign(new Error('aborted'), {
            name: 'AbortError',
        })
        mockFetchNameSearch.mockRejectedValue(abort)

        await expect(
            resolveVerifiedNameAddress({ name: 'alice.eth', scope: SCOPE }),
        ).rejects.toBe(abort)
    })
})
