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

import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RekeyTargetNotFoundError } from '@perawallet/wallet-core-accounts'
import type { SignRequestStatus } from '@perawallet/wallet-core-multisig'
import type { SignRequest } from '@perawallet/wallet-core-signing'
import { useSignRequestFailure } from '../useSignRequestFailure'

const mockConfig = vi.hoisted(() => ({ debugEnabled: false }))
const mocks = vi.hoisted(() => ({
    invalidateQueries: vi.fn(),
    useSignRequestDetailQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-config', () => ({ config: mockConfig }))

// The global mock in vitest.setup.ts omits this class, and `instanceof` needs
// the same identity the hook imports — so re-mock the module here.
vi.mock('@perawallet/wallet-core-accounts', () => ({
    RekeyTargetNotFoundError: class RekeyTargetNotFoundError extends Error {
        readonly metadata: { params: { rekeyAddress: string } }
        constructor(rekeyAddress: string) {
            super(`Rekey target ${rekeyAddress} not found`)
            this.metadata = { params: { rekeyAddress } }
        }
    },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => 'device-1',
}))

vi.mock('@perawallet/wallet-core-multisig', () => ({
    getSignRequestDetailQueryKey: (network: string, id: string) => [
        'signRequestDetail',
        network,
        id,
    ],
    useSignRequestDetailQuery: (params: unknown) =>
        mocks.useSignRequestDetailQuery(params),
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}))

const COSIGN_REQUEST = {
    id: 'req-1',
    type: 'transactions',
    transport: 'callback',
    sourceType: 'multisig-cosign',
    signRequestId: 'sr-1',
} as unknown as SignRequest

const WALLETCONNECT_REQUEST = {
    id: 'req-2',
    type: 'transactions',
    transport: 'callback',
    sourceType: 'walletconnect',
} as unknown as SignRequest

const setStatus = (status: SignRequestStatus | null) => {
    mocks.useSignRequestDetailQuery.mockReturnValue({
        data: status ? { status } : undefined,
    })
}

describe('useSignRequestFailure', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockConfig.debugEnabled = false
        mocks.invalidateQueries.mockResolvedValue(undefined)
        setStatus(null)
    })

    it.each([
        ['confirmed', 'multisig.already_resolved.confirmed'],
        ['declined', 'multisig.already_resolved.declined'],
        ['expired', 'multisig.already_resolved.expired'],
    ])(
        'explains that a cosign failed because the request was already %s',
        async (status, keyPrefix) => {
            setStatus(status as SignRequestStatus)

            const { result } = renderHook(() =>
                useSignRequestFailure(COSIGN_REQUEST, new Error('boom')),
            )

            await waitFor(() => expect(result.current.isResolving).toBe(false))
            expect(result.current.title).toBe(`${keyPrefix}.title`)
            expect(result.current.body).toBe(`${keyPrefix}.body`)
        },
    )

    it('keeps the generic copy for a request whose broadcast genuinely failed', async () => {
        setStatus('failed')

        const { result } = renderHook(() =>
            useSignRequestFailure(COSIGN_REQUEST, new Error('boom')),
        )

        await waitFor(() => expect(result.current.isResolving).toBe(false))
        expect(result.current.title).toBe('signing.signing_failed.title')
        expect(result.current.body).toBe('signing.signing_failed.body')
    })

    it('re-reads the status before deciding, so a stale cached status cannot win', () => {
        setStatus('confirmed')

        renderHook(() =>
            useSignRequestFailure(COSIGN_REQUEST, new Error('boom')),
        )

        expect(mocks.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ['signRequestDetail', 'mainnet', 'sr-1'],
        })
    })

    it('reports resolving until the re-read settles, so the generic copy never flashes', () => {
        mocks.invalidateQueries.mockReturnValue(new Promise(() => {}))
        setStatus('confirmed')

        const { result } = renderHook(() =>
            useSignRequestFailure(COSIGN_REQUEST, new Error('boom')),
        )

        expect(result.current.isResolving).toBe(true)
    })

    it('does not re-read anything for a non-multisig request', () => {
        const { result } = renderHook(() =>
            useSignRequestFailure(WALLETCONNECT_REQUEST, new Error('boom')),
        )

        expect(mocks.invalidateQueries).not.toHaveBeenCalled()
        expect(result.current.isResolving).toBe(false)
        expect(result.current.body).toBe('signing.signing_failed.body')
    })

    it('still explains a missing rekey target', () => {
        const { result } = renderHook(() =>
            useSignRequestFailure(
                WALLETCONNECT_REQUEST,
                new RekeyTargetNotFoundError('AUTH_ADDR'),
            ),
        )

        expect(result.current.body).toBe(
            'signing.cannot_sign.rekeyed_auth_missing_body',
        )
    })

    it('surfaces the raw error message in debug builds', () => {
        mockConfig.debugEnabled = true

        const { result } = renderHook(() =>
            useSignRequestFailure(WALLETCONNECT_REQUEST, new Error('raw boom')),
        )

        expect(result.current.body).toBe('raw boom')
    })

    it('prefers the already-resolved explanation over the raw debug message', async () => {
        mockConfig.debugEnabled = true
        setStatus('confirmed')

        const { result } = renderHook(() =>
            useSignRequestFailure(COSIGN_REQUEST, new Error('raw boom')),
        )

        await waitFor(() => expect(result.current.isResolving).toBe(false))
        expect(result.current.body).toBe(
            'multisig.already_resolved.confirmed.body',
        )
    })
})
