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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type {
    MultisigSignRequest,
    SignRequestStatus,
} from '@perawallet/wallet-core-multisig'

const useSignRequestDetailQueryMock =
    vi.fn<() => { data: MultisigSignRequest | undefined }>()

vi.mock('@hooks/useIsDarkMode', () => ({ useIsDarkMode: () => false }))
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))
vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceID: () => 'device-id',
}))
vi.mock('@perawallet/wallet-core-multisig', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@perawallet/wallet-core-multisig')
        >()
    return {
        ...actual,
        useSignRequestDetailQuery: (...args: unknown[]) =>
            useSignRequestDetailQueryMock(...(args as [])),
    }
})
vi.mock('@modules/multisig/utils', () => ({ getSignedResponseCount: () => 1 }))
vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        formatRelativeTime: () => '1m ago',
        formatTimeRemaining: () => '52m',
        truncateAlgorandAddress: (a: string) => a,
    }
})

import { useMultisigSignInboxItem } from '../useMultisigSignInboxItem'

const FAILED_RECOVERY_WINDOW_MS = 30_000

const buildItem = (status: SignRequestStatus) => ({
    type: 'multisig_sign' as const,
    createdAt: new Date('2026-05-06T09:00:00Z'),
    data: {
        id: 'sr-1',
        status,
        multisigAccount: { address: 'MULTISIG', threshold: 2 },
        expectedExpireDatetime: new Date('2026-05-06T10:52:00Z'),
        transactionLists: [{ responses: [] }],
    } as unknown as MultisigSignRequest,
})

// Casts the loosely-typed fixture to the exact param type the hook expects.
const render = (item: ReturnType<typeof buildItem>) =>
    renderHook(() =>
        useMultisigSignInboxItem(
            item as unknown as Parameters<typeof useMultisigSignInboxItem>[0],
        ),
    )

describe('useMultisigSignInboxItem', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        useSignRequestDetailQueryMock.mockReset()
        useSignRequestDetailQueryMock.mockReturnValue({ data: undefined })
    })

    it('renders a confirmed request as success without polling for recovery', () => {
        const { result } = render(buildItem('confirmed'))

        expect(result.current.isSuccess).toBe(true)
        expect(result.current.isFailure).toBe(false)
        expect(useSignRequestDetailQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({ enabled: false }),
        )
    })

    it('holds a freshly failed request as still-waiting (not a failure) during the recovery window', () => {
        const { result } = render(buildItem('failed'))

        expect(result.current.isFailure).toBe(false)
        expect(result.current.isWaiting).toBe(true)
        expect(result.current.statusKey).toBe(
            'messages.inbox.multisig_sign.status_pending',
        )
        // Detail poll is enabled so a backend correction can supersede.
        expect(useSignRequestDetailQueryMock).toHaveBeenCalledWith(
            expect.objectContaining({
                enabled: true,
                signRequestId: 'sr-1',
                pollWhileFailed: true,
            }),
        )
    })

    it('supersedes a stale list `failed` with a recovered `confirmed`', () => {
        useSignRequestDetailQueryMock.mockReturnValue({
            data: {
                id: 'sr-1',
                status: 'confirmed',
                multisigAccount: { address: 'MULTISIG', threshold: 2 },
                expectedExpireDatetime: new Date('2026-05-06T10:52:00Z'),
                transactionLists: [{ responses: [] }],
            } as unknown as MultisigSignRequest,
        })

        const { result } = render(buildItem('failed'))

        expect(result.current.isSuccess).toBe(true)
        expect(result.current.isFailure).toBe(false)
    })

    it('commits to failure once the recovery window elapses with no correction', () => {
        const { result, rerender } = render(buildItem('failed'))

        expect(result.current.isFailure).toBe(false)

        act(() => {
            vi.advanceTimersByTime(FAILED_RECOVERY_WINDOW_MS)
        })
        rerender()

        expect(result.current.isFailure).toBe(true)
        expect(result.current.statusKey).toBe(
            'messages.inbox.multisig_sign.status_failed',
        )
    })

    it.each<SignRequestStatus>(['expired', 'declined'])(
        'treats %s as an immediate failure with no recovery poll (genuinely terminal)',
        status => {
            const { result } = render(buildItem(status))

            expect(result.current.isFailure).toBe(true)
            expect(useSignRequestDetailQueryMock).toHaveBeenCalledWith(
                expect.objectContaining({ enabled: false }),
            )
        },
    )
})
