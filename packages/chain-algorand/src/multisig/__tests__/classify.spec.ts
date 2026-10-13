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
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { getAlgorandClient } from '../../blockchain/utils/algorandClient'
import { algorandMultisigAdapter } from '../adapter'

vi.mock('../../blockchain/utils/algorandClient', () => ({
    getAlgorandClient: vi.fn(),
}))

const ADDRESS = 'A'.repeat(58)
const SCOPE = scopeForLegacyNetwork('testnet')

describe('algorandMultisigAdapter.classifyParticipant', () => {
    let mockLookupAccountByID: Mock
    let mockDo: Mock

    beforeEach(() => {
        vi.clearAllMocks()
        mockDo = vi.fn().mockResolvedValue({
            account: { address: ADDRESS, sigType: 'pqsig' },
        })
        mockLookupAccountByID = vi.fn(() => ({
            exclude: () => ({ do: mockDo }),
        }))
        ;(getAlgorandClient as Mock).mockReturnValue({
            client: { indexer: { lookupAccountByID: mockLookupAccountByID } },
        })
    })

    test("rejects an address the scope's indexer saw sign post-quantum", async () => {
        await expect(
            algorandMultisigAdapter.classifyParticipant(ADDRESS, SCOPE),
        ).resolves.toBe('incompatible-scheme')
        expect(getAlgorandClient).toHaveBeenCalledWith(SCOPE)
        expect(mockLookupAccountByID).toHaveBeenCalledWith(ADDRESS)
    })

    test('accepts an address the indexer saw sign Ed25519', async () => {
        mockDo.mockResolvedValue({
            account: { address: ADDRESS, sigType: 'sig' },
        })

        await expect(
            algorandMultisigAdapter.classifyParticipant(ADDRESS, SCOPE),
        ).resolves.toBe('eligible')
    })

    test('leaves an account with no sig-type unclassified', async () => {
        mockDo.mockResolvedValue({ account: { address: ADDRESS } })

        await expect(
            algorandMultisigAdapter.classifyParticipant(ADDRESS, SCOPE),
        ).resolves.toBe('unclassified')
    })

    test('leaves an unrecognized sig-type unclassified instead of surfacing it', async () => {
        mockDo.mockResolvedValue({
            account: { address: ADDRESS, sigType: 'something-new' },
        })

        await expect(
            algorandMultisigAdapter.classifyParticipant(ADDRESS, SCOPE),
        ).resolves.toBe('unclassified')
    })

    test('treats an address the indexer has never seen (404) as unclassified, not an error', async () => {
        mockDo.mockRejectedValue(
            Object.assign(new Error('account not found'), { status: 404 }),
        )

        await expect(
            algorandMultisigAdapter.classifyParticipant(ADDRESS, SCOPE),
        ).resolves.toBe('unclassified')
    })

    test('surfaces any other indexer failure', async () => {
        mockDo.mockRejectedValue(
            Object.assign(new Error('indexer down'), { status: 503 }),
        )

        await expect(
            algorandMultisigAdapter.classifyParticipant(ADDRESS, SCOPE),
        ).rejects.toThrow('indexer down')
    })
})
