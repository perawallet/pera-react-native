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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useNetworkStatusStore } from '@modules/network'
import { useInboxScreen } from '../useInboxScreen'
import { useInboxQuery, type InboxItem } from '@perawallet/wallet-core-messages'
import { useIsDeviceRegistrationPending } from '@perawallet/wallet-core-device'
import { IntegrityRequiredError } from '@perawallet/wallet-core-shared'
import { useAccountValueBasis } from '@perawallet/wallet-core-accounts'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'

const mockHandleInboxItemPress = vi.fn()
const mockTokenInboxes = vi.fn((): unknown[] => [])

vi.mock('@perawallet/wallet-core-messages', () => ({
    useInboxQuery: vi.fn(),
    useCleanupDuplicateMultisigInvitations: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useIsDeviceRegistrationPending: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAccountValueBasis: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    chainDisplayNameOf: vi.fn(),
}))

vi.mock('@modules/messages/hooks', () => ({
    useHandleInboxItemPress: () => mockHandleInboxItemPress,
    useTokenInboxes: () => mockTokenInboxes(),
}))

const ALGORAND_SCOPE = { chainId: 'algorand', networkId: 'mainnet' }
const BASE_SCOPE = { chainId: 'base', networkId: 'mainnet' }

describe('useInboxScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useNetworkStatusStore.getState().setHasInternet(true)
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [],
            isPending: false,
            isRefetching: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useInboxQuery>)
        vi.mocked(useIsDeviceRegistrationPending).mockReturnValue(false)
        vi.mocked(useAccountValueBasis).mockReturnValue('native')
        vi.mocked(chainDisplayNameOf).mockImplementation(chainId =>
            chainId === 'base' ? 'Base' : 'Algorand',
        )
        mockTokenInboxes.mockReturnValue([])
    })

    const signItem = {
        type: 'multisig_sign' as const,
        data: { id: 'sign-1', multisigAccount: { address: 'MSIG_ADDR' } },
        createdAt: new Date(0),
    }
    const tokenInbox = {
        scope: BASE_SCOPE,
        item: {
            type: 'asa_inbox' as const,
            data: { address: '0xabc', inboxAddress: null, requestCount: 2 },
            createdAt: new Date(0),
        },
    }
    const withBackendItem = () =>
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [signItem],
            isPending: false,
            isRefetching: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useInboxQuery>)

    it('names the inbox chain for the row badge once the wallet spans chains', () => {
        withBackendItem()
        vi.mocked(useAccountValueBasis).mockReturnValue('fiat')

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.inboxEntries[0]?.chainBadgeName).toBe('Algorand')
    })

    it('leaves the backend rows unbadged while the wallet is on one chain', () => {
        withBackendItem()

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.inboxEntries[0]?.chainBadgeName).toBeUndefined()
    })

    it('lists the device token inboxes after the backend items, each under its own network', () => {
        withBackendItem()
        mockTokenInboxes.mockReturnValue([tokenInbox])

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.inboxEntries).toEqual([
            {
                item: signItem,
                scope: ALGORAND_SCOPE,
                chainBadgeName: undefined,
            },
            {
                item: tokenInbox.item,
                scope: BASE_SCOPE,
                chainBadgeName: 'Base',
            },
        ])
    })

    it('opens a token inbox on its own scope', () => {
        mockTokenInboxes.mockReturnValue([tokenInbox])

        const { result } = renderHook(() => useInboxScreen())
        act(() => {
            result.current.handleInboxItemPress(result.current.inboxEntries[0]!)
        })

        expect(mockHandleInboxItemPress).toHaveBeenCalledWith(
            tokenInbox.item,
            BASE_SCOPE,
        )
    })

    it('is not awaiting registration while a token inbox is listed', () => {
        vi.mocked(useIsDeviceRegistrationPending).mockReturnValue(true)
        mockTokenInboxes.mockReturnValue([tokenInbox])

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.isAwaitingRegistration).toBe(false)
    })

    it('returns empty inbox array when data is undefined', () => {
        vi.mocked(useInboxQuery).mockReturnValue({
            data: undefined,
            isPending: true,
            isRefetching: false,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.inboxEntries).toEqual([])
        expect(result.current.isPending).toBe(true)
    })

    it('delegates a backend item press to the shared handler on the inbox scope', () => {
        withBackendItem()

        const { result } = renderHook(() => useInboxScreen())
        act(() => {
            result.current.handleInboxItemPress(result.current.inboxEntries[0]!)
        })

        expect(mockHandleInboxItemPress).toHaveBeenCalledWith(
            signItem as unknown as InboxItem,
            ALGORAND_SCOPE,
        )
    })

    it('refetches the inbox when refresh is triggered', () => {
        const mockRefetch = vi.fn()
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [],
            isPending: false,
            isRefetching: false,
            refetch: mockRefetch,
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { result } = renderHook(() => useInboxScreen())

        act(() => {
            result.current.refetch()
        })

        expect(mockRefetch).toHaveBeenCalledTimes(1)
    })

    it('surfaces the refetching state of the inbox query', () => {
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [],
            isPending: false,
            isRefetching: true,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.isRefetching).toBe(true)
    })

    it('is awaiting registration when there are no items and registration is pending', () => {
        vi.mocked(useIsDeviceRegistrationPending).mockReturnValue(true)

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.isAwaitingRegistration).toBe(true)
    })

    it('is not awaiting registration when items are present, even if registration is pending', () => {
        withBackendItem()
        vi.mocked(useIsDeviceRegistrationPending).mockReturnValue(true)

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.isAwaitingRegistration).toBe(false)
    })

    it('forwards isUnavailableOnNetwork from the inbox query', () => {
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [],
            isPending: false,
            isRefetching: false,
            refetch: vi.fn(),
            isUnavailableOnNetwork: true,
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.isUnavailableOnNetwork).toBe(true)
    })

    it('is not awaiting registration when the network is unavailable, even if registration is pending', () => {
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [],
            isPending: false,
            isRefetching: false,
            refetch: vi.fn(),
            isUnavailableOnNetwork: true,
        } as unknown as ReturnType<typeof useInboxQuery>)
        vi.mocked(useIsDeviceRegistrationPending).mockReturnValue(true)

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.isAwaitingRegistration).toBe(false)
    })

    it('flags offline while the inbox query is paused', () => {
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [],
            isPending: false,
            isRefetching: false,
            refetch: vi.fn(),
            isPaused: true,
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.isOffline).toBe(true)
    })

    it('flags offline for an error on a device with no internet', () => {
        useNetworkStatusStore.getState().setHasInternet(false)
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [],
            isPending: false,
            isRefetching: false,
            refetch: vi.fn(),
            isError: true,
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.isOffline).toBe(true)
    })

    it('flags a refusal for want of an integrity token', () => {
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [],
            isPending: false,
            isRefetching: false,
            refetch: vi.fn(),
            isError: true,
            error: new IntegrityRequiredError({
                code: 'APP_INTEGRITY_TOKEN_REQUIRED',
                status: 403,
                hadToken: false,
            }),
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.isIntegrityBlocked).toBe(true)
    })

    it('does not flag any other failure as an integrity refusal', () => {
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [],
            isPending: false,
            isRefetching: false,
            refetch: vi.fn(),
            isError: true,
            error: new Error('boom'),
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.isIntegrityBlocked).toBe(false)
    })

    it('keeps an online error as an error, not offline', () => {
        vi.mocked(useInboxQuery).mockReturnValue({
            data: [],
            isPending: false,
            isRefetching: false,
            refetch: vi.fn(),
            isError: true,
        } as unknown as ReturnType<typeof useInboxQuery>)

        const { result } = renderHook(() => useInboxScreen())

        expect(result.current.isOffline).toBe(false)
        expect(result.current.isError).toBe(true)
    })
})
