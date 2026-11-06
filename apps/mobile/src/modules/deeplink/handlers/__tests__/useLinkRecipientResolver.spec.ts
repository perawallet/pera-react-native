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
import { renderHook } from '@testing-library/react'

const { mockResolve, mockShowError, mockNameServiceOf } = vi.hoisted(() => ({
    mockResolve: vi.fn(),
    mockShowError: vi.fn(),
    mockNameServiceOf: vi.fn(() => 'ens'),
}))

vi.mock('@perawallet/wallet-core-nfd', () => ({
    resolveVerifiedNameAddress: mockResolve,
    nameServiceOf: mockNameServiceOf,
}))
vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getChainDescriptor: () => ({ displayName: 'Base' }),
}))
vi.mock('../useDeeplinkErrorHandler', () => ({
    useDeeplinkErrorHandler: () => mockShowError,
}))

import { useLinkRecipientResolver } from '../useLinkRecipientResolver'

const SCOPE = { chainId: 'base', networkId: 'mainnet' } as const
const PARAMS = { scope: SCOPE, name: 'alice.eth', parsedType: 'TRANSFER' }

describe('useLinkRecipientResolver', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns the verified address without showing an error', async () => {
        mockResolve.mockResolvedValue({ status: 'verified', address: '0xabc' })
        const { result } = renderHook(() => useLinkRecipientResolver())

        await expect(result.current(PARAMS)).resolves.toBe('0xabc')
        expect(mockResolve).toHaveBeenCalledWith({
            name: 'alice.eth',
            scope: SCOPE,
        })
        expect(mockShowError).not.toHaveBeenCalled()
    })

    it('reports a name with no record on the linked chain by chain name', async () => {
        mockResolve.mockResolvedValue({ status: 'not-found' })
        const { result } = renderHook(() => useLinkRecipientResolver())

        await expect(result.current(PARAMS)).resolves.toBeUndefined()
        expect(mockShowError).toHaveBeenCalledWith({
            variant: 'name-not-found',
            parsedType: 'TRANSFER',
            values: { name: 'alice.eth', chain: 'Base' },
        })
    })

    it.each([
        ['mismatch', 'name-mismatch'],
        ['unavailable', 'name-unavailable'],
    ] as const)(
        'reports a %s verdict with the name service copy',
        async (status, variant) => {
            mockResolve.mockResolvedValue({ status })
            const { result } = renderHook(() => useLinkRecipientResolver())

            await expect(result.current(PARAMS)).resolves.toBeUndefined()
            expect(mockShowError).toHaveBeenCalledWith({
                variant,
                service: 'ens',
                parsedType: 'TRANSFER',
                values: { name: 'alice.eth' },
            })
        },
    )
})
