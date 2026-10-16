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
import { renderHook, act } from '@testing-library/react'
import {
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { MultisigEvent } from '@analytics'

import type { MultisigInvitationParam } from '../../../routes/types'
import { useMultisigInvitationDetailContent } from '../useMultisigInvitationDetailContent'

const mocks = vi.hoisted(() => ({
    deviceId: 'device-id' as string | undefined,
    mutateAsync: vi.fn(),
    errorToast: vi.fn(),
    trackEvent: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', async importOriginal => ({
    ...(await importOriginal<object>()),
    useScopedDeviceID: () => mocks.deviceId,
}))

vi.mock('@perawallet/wallet-core-messages', async importOriginal => ({
    ...(await importOriginal<object>()),
    useDeleteMultisigInvitationMutation: () => ({
        mutateAsync: mocks.mutateAsync,
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: mocks.errorToast }),
}))

vi.mock('@hooks/useLanguage')

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<object>()),
    trackEvent: mocks.trackEvent,
}))

const invitation: MultisigInvitationParam = {
    customId: 'invite-1',
    createdAt: '2025-01-15T00:00:00.000Z',
    address: 'MSIG_ADDR',
    version: 1,
    threshold: 2,
    participantAddresses: ['ADDR1', 'ADDR2', 'ADDR3'],
}

const accountAt = (address: string): WalletAccount =>
    ({
        id: address,
        custody: { kind: 'local' },
        chains: { algorand: { address } },
    }) as unknown as WalletAccount

const setup = () => {
    const onIgnored = vi.fn()
    const onAccepted = vi.fn()
    const hook = renderHook(() =>
        useMultisigInvitationDetailContent({
            invitation,
            onIgnored,
            onAccepted,
        }),
    )
    return { ...hook, onIgnored, onAccepted }
}

describe('useMultisigInvitationDetailContent', () => {
    beforeEach(() => {
        mocks.deviceId = 'device-id'
        mocks.mutateAsync.mockResolvedValue(undefined)
        vi.mocked(useAllAccounts).mockReturnValue([])
    })

    it('counts every participant', () => {
        const { result } = setup()

        expect(result.current.renderedInvitation).toBe(invitation)
        expect(result.current.totalParticipants).toBe(3)
    })

    it('flags the user as included when one of their accounts already participates', () => {
        vi.mocked(useAllAccounts).mockReturnValue([
            accountAt('OTHER'),
            accountAt('ADDR2'),
        ])

        const { result } = setup()

        expect(result.current.isUserIncluded).toBe(true)
    })

    it('does not flag the user when none of their accounts participate', () => {
        vi.mocked(useAllAccounts).mockReturnValue([
            accountAt('OTHER'),
            { id: 'no-chain', chains: {} } as unknown as WalletAccount,
        ])

        const { result } = setup()

        expect(result.current.isUserIncluded).toBe(false)
    })

    it('tracks and hands off on accept', () => {
        const { result, onAccepted } = setup()

        act(() => result.current.handleAccept())

        expect(mocks.trackEvent).toHaveBeenCalledWith(
            MultisigEvent.InviteAddPressed,
        )
        expect(onAccepted).toHaveBeenCalledTimes(1)
    })

    it('deletes the invitation and reports it ignored on decline', async () => {
        const { result, onIgnored } = setup()

        await act(() => result.current.handleIgnore())

        expect(mocks.trackEvent).toHaveBeenCalledWith(
            MultisigEvent.InviteIgnorePressed,
        )
        expect(mocks.mutateAsync).toHaveBeenCalledWith({
            multisigAddress: 'MSIG_ADDR',
        })
        expect(onIgnored).toHaveBeenCalledTimes(1)
        expect(result.current.isIgnoring).toBe(false)
    })

    it('shows an error without calling the API when there is no device id', async () => {
        mocks.deviceId = undefined
        const { result, onIgnored } = setup()

        await act(() => result.current.handleIgnore())

        expect(mocks.mutateAsync).not.toHaveBeenCalled()
        expect(onIgnored).not.toHaveBeenCalled()
        expect(mocks.errorToast).toHaveBeenCalledWith(
            'multisig.invitation.title',
            'multisig.invitation.ignore_error',
        )
    })

    it('shows an error and stays on the invitation when the delete fails', async () => {
        mocks.mutateAsync.mockRejectedValue(new Error('network'))
        const { result, onIgnored } = setup()

        await act(() => result.current.handleIgnore())

        expect(onIgnored).not.toHaveBeenCalled()
        expect(mocks.errorToast).toHaveBeenCalledWith(
            'multisig.invitation.title',
            'multisig.invitation.ignore_error',
        )
        expect(result.current.isIgnoring).toBe(false)
    })

    it('ignores a second decline while the first is in flight', async () => {
        let finishDelete: () => void = () => undefined
        mocks.mutateAsync.mockReturnValue(
            new Promise<void>(resolve => {
                finishDelete = resolve
            }),
        )
        const { result } = setup()

        let first: Promise<void> = Promise.resolve()
        act(() => {
            first = result.current.handleIgnore()
        })
        expect(result.current.isIgnoring).toBe(true)

        await act(() => result.current.handleIgnore())
        await act(async () => {
            finishDelete()
            await first
        })

        expect(mocks.mutateAsync).toHaveBeenCalledTimes(1)
        expect(mocks.trackEvent).toHaveBeenCalledTimes(1)
    })
})
