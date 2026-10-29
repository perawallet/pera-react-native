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
import { renderHook, act } from '@testing-library/react'
import type { Contact } from '@perawallet/wallet-core-contacts'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { useAccountActions } from '../useAccountActions'

const {
    mockNavigate,
    mockSetSelectedContact,
    mockRequestByType,
    mockSetDestination,
    mockSetChainId,
    mockReset,
    mockResolveSender,
    mockPickSender,
    mockSetSelectedAccountId,
    mockFirstUnreachableChainsNote,
    accountsRef,
    contactsRef,
} = vi.hoisted(() => ({
    mockNavigate: vi.fn(),
    mockSetSelectedContact: vi.fn(),
    mockRequestByType: vi.fn(),
    mockSetDestination: vi.fn(),
    mockSetChainId: vi.fn(),
    mockReset: vi.fn(),
    mockResolveSender: vi.fn(),
    mockPickSender: vi.fn(),
    mockSetSelectedAccountId: vi.fn(),
    mockFirstUnreachableChainsNote: vi.fn(),
    accountsRef: { accounts: [] as unknown[] },
    contactsRef: { contacts: [] as Contact[] },
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useSelectedAccountId: () => ({
        selectedAccountId: null,
        setSelectedAccountId: mockSetSelectedAccountId,
    }),
    useAllAccounts: () => accountsRef.accounts,
    firstUnreachableChainsNote: mockFirstUnreachableChainsNote,
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mockNavigate }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ requestByType: mockRequestByType }),
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: () => ({
        contacts: contactsRef.contacts,
        setSelectedContact: mockSetSelectedContact,
    }),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useSendAccountResolver: () => ({
        resolve: mockResolveSender,
        pick: mockPickSender,
    }),
    useSendFundsStore: {
        getState: () => ({
            reset: mockReset,
            setDestination: mockSetDestination,
            setChainId: mockSetChainId,
        }),
    },
}))

const ADDRESS = 'A'.repeat(58)
const onClose = vi.fn()
const SENDER = { id: 'sender' }
const OTHER_SENDER = { id: 'other-sender' }

describe('useAccountActions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        contactsRef.contacts = []
        accountsRef.accounts = [SENDER]
        mockFirstUnreachableChainsNote.mockReturnValue(null)
        useRemoteConfigStore.getState().resetState()
    })

    it('offers watching an address only while the watchAccounts capability is on', () => {
        const { result } = renderHook(() =>
            useAccountActions({ address: ADDRESS, onClose }),
        )
        expect(result.current.canAddWatchAccount).toBe(true)

        act(() => setCapabilityOverrides({ watchAccounts: false }))

        expect(result.current.canAddWatchAccount).toBe(false)
    })

    it('reports no existing contacts when the address is unknown', () => {
        const { result } = renderHook(() =>
            useAccountActions({ address: ADDRESS, onClose }),
        )
        expect(result.current.existingContacts).toEqual([])
    })

    it('reports every contact saved at the address', () => {
        const alice: Contact = {
            id: 'alice-id',
            name: 'Alice',
            addresses: { algorand: ADDRESS },
        }
        const aliceAlgo: Contact = { ...alice, id: 'alice-algo-id' }
        contactsRef.contacts = [alice, aliceAlgo]

        const { result } = renderHook(() =>
            useAccountActions({ address: ADDRESS, onClose }),
        )
        expect(result.current.existingContacts).toEqual([alice, aliceAlgo])
    })

    it('addContact navigates to AddContact with the address prefilled', () => {
        const { result } = renderHook(() =>
            useAccountActions({
                address: ADDRESS,
                label: 'Bob',
                onClose,
            }),
        )

        act(() => result.current.addContact())

        expect(mockSetSelectedContact).not.toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledWith('Contacts', {
            screen: 'AddContact',
            params: { address: ADDRESS, label: 'Bob' },
        })
    })

    it('editContact selects the given contact and navigates to EditContact', () => {
        const existing: Contact = {
            id: 'alice-id',
            name: 'Alice',
            addresses: { algorand: ADDRESS },
        }
        contactsRef.contacts = [existing]

        const { result } = renderHook(() =>
            useAccountActions({ address: ADDRESS, onClose }),
        )

        act(() => result.current.editContact(existing))

        // EditContactScreen reads from the contacts store via
        // selectedContact, so the contact must be set before navigation.
        expect(mockSetSelectedContact).toHaveBeenCalledWith(existing)
        expect(mockNavigate).toHaveBeenCalledWith('Contacts', {
            screen: 'EditContact',
        })
    })

    it('openSendTransaction prefills destination and opens send-funds sheet', () => {
        const { result } = renderHook(() =>
            useAccountActions({ address: ADDRESS, onClose }),
        )

        act(() => result.current.openSendTransaction())

        expect(mockReset).toHaveBeenCalled()
        expect(mockSetDestination).toHaveBeenCalledWith(ADDRESS)
        expect(mockSetChainId).not.toHaveBeenCalled()
        expect(mockRequestByType).toHaveBeenCalledWith(
            'send-funds',
            {},
            expect.objectContaining({ size: 'modal' }),
        )
    })

    describe('with the address chain known', () => {
        it('narrows watching to that chain', () => {
            mockResolveSender.mockReturnValue({ kind: 'none' })
            const { result } = renderHook(() =>
                useAccountActions({
                    address: ADDRESS,
                    chainId: 'algorand',
                    onClose,
                }),
            )
            expect(result.current.canAddWatchAccount).toBe(true)

            act(() => setCapabilityOverrides({ watchAccounts: false }))

            expect(result.current.canAddWatchAccount).toBe(false)
        })

        it('hides send when no account on the chain can send', () => {
            mockResolveSender.mockReturnValue({ kind: 'none' })
            const { result } = renderHook(() =>
                useAccountActions({
                    address: ADDRESS,
                    chainId: 'algorand',
                    onClose,
                }),
            )
            expect(result.current.canSend).toBe(false)
            expect(result.current.sendUnavailableNote).toBeNull()
        })

        it("says why send is unavailable when a held account's kind can't reach the chain", () => {
            mockResolveSender.mockReturnValue({ kind: 'none' })
            mockFirstUnreachableChainsNote.mockReturnValue(
                'kind.unreachable_note',
            )
            const { result } = renderHook(() =>
                useAccountActions({
                    address: ADDRESS,
                    chainId: 'algorand',
                    onClose,
                }),
            )

            expect(result.current.canSend).toBe(false)
            expect(result.current.sendUnavailableNote).toBe(
                'kind.unreachable_note',
            )
            expect(mockFirstUnreachableChainsNote).toHaveBeenCalledWith(
                [SENDER],
                ['algorand'],
            )
        })

        it('gives no note while an account can send on the chain', () => {
            mockResolveSender.mockReturnValue({
                kind: 'single',
                account: SENDER,
            })
            mockFirstUnreachableChainsNote.mockReturnValue(
                'kind.unreachable_note',
            )
            const { result } = renderHook(() =>
                useAccountActions({
                    address: ADDRESS,
                    chainId: 'algorand',
                    onClose,
                }),
            )

            expect(result.current.canSend).toBe(true)
            expect(result.current.sendUnavailableNote).toBeNull()
        })

        it('hides send when the chain has send switched off', () => {
            mockResolveSender.mockReturnValue({
                kind: 'single',
                account: SENDER,
            })
            const { result } = renderHook(() =>
                useAccountActions({
                    address: ADDRESS,
                    chainId: 'algorand',
                    onClose,
                }),
            )
            expect(result.current.canSend).toBe(true)

            act(() => setCapabilityOverrides({ send: false }))

            expect(result.current.canSend).toBe(false)
        })

        it('sends from the one account on the chain', () => {
            mockResolveSender.mockReturnValue({
                kind: 'single',
                account: SENDER,
            })
            const { result } = renderHook(() =>
                useAccountActions({
                    address: ADDRESS,
                    chainId: 'algorand',
                    onClose,
                }),
            )

            act(() => result.current.openSendTransaction())

            expect(mockSetSelectedAccountId).toHaveBeenCalledWith('sender')
            expect(mockSetDestination).toHaveBeenCalledWith(ADDRESS)
            // The address names its network, so the send skips Choose Network.
            expect(mockSetChainId).toHaveBeenCalledWith('algorand')
            expect(mockRequestByType).toHaveBeenCalledWith(
                'send-funds',
                {},
                expect.anything(),
            )
        })

        it('sends from the account picked when several can', async () => {
            mockResolveSender.mockReturnValue({
                kind: 'picker',
                accounts: [SENDER, OTHER_SENDER],
            })
            mockPickSender.mockResolvedValue(OTHER_SENDER)
            const { result } = renderHook(() =>
                useAccountActions({
                    address: ADDRESS,
                    chainId: 'algorand',
                    onClose,
                }),
            )

            await act(async () => result.current.openSendTransaction())

            expect(mockPickSender).toHaveBeenCalledWith('algorand', [
                SENDER,
                OTHER_SENDER,
            ])
            expect(mockSetSelectedAccountId).toHaveBeenCalledWith(
                'other-sender',
            )
            expect(mockRequestByType).toHaveBeenCalledWith(
                'send-funds',
                {},
                expect.anything(),
            )
        })

        it('opens nothing when the picker is dismissed', async () => {
            mockResolveSender.mockReturnValue({
                kind: 'picker',
                accounts: [SENDER, OTHER_SENDER],
            })
            mockPickSender.mockResolvedValue(undefined)
            const { result } = renderHook(() =>
                useAccountActions({
                    address: ADDRESS,
                    chainId: 'algorand',
                    onClose,
                }),
            )

            await act(async () => result.current.openSendTransaction())

            expect(mockSetSelectedAccountId).not.toHaveBeenCalled()
            expect(mockRequestByType).not.toHaveBeenCalled()
        })
    })

    it('openWatchAddress navigates to WatchAccount with prefill', () => {
        const { result } = renderHook(() =>
            useAccountActions({ address: ADDRESS, onClose }),
        )

        act(() => result.current.openWatchAddress())

        expect(mockNavigate).toHaveBeenCalledWith('AddAccount', {
            screen: 'WatchAccount',
            params: { prefillAddress: ADDRESS },
        })
    })
})
