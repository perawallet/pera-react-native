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
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAddParticipantContent } from '../useAddParticipantContent'

const LOCAL_ALGO_ADDR = 'A'.repeat(58)
const LOCAL_WATCH_ADDR = 'W'.repeat(58)
const CONTACT_ADDR = 'C'.repeat(58)
const EXTERNAL_ADDR = 'E'.repeat(58)
const MULTISIG_ADDR = 'M'.repeat(58)

const { mockErrorToast } = vi.hoisted(() => ({ mockErrorToast: vi.fn() }))
const { mockResolve } = vi.hoisted(() => ({ mockResolve: vi.fn() }))
const { mockDismiss } = vi.hoisted(() => ({ mockDismiss: vi.fn() }))

const multisigCheckState: {
    data: { isMultisig: boolean } | undefined
    isFetching: boolean
} = { data: undefined, isFetching: false }

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ errorToast: mockErrorToast }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({
        resolve: mockResolve,
        dismiss: mockDismiss,
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-accounts')
    >('@perawallet/wallet-core-accounts')
    return {
        ...actual,
        useAllAccounts: () => [
            { address: LOCAL_ALGO_ADDR, type: actual.AccountTypes.algo25 },
            { address: LOCAL_WATCH_ADDR, type: actual.AccountTypes.watch },
        ],
    }
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    // The accounts barrel subscribes to the network store at load.
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
    useNetwork: () => ({ network: 'testnet' }),
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: () => ({
        contacts: [{ address: CONTACT_ADDR, name: 'Bob' }],
    }),
}))

vi.mock('@perawallet/wallet-core-multisig', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-multisig')
    >('@perawallet/wallet-core-multisig')
    return {
        ...actual,
        useIsMultisigAddressQuery: () => multisigCheckState,
    }
})

describe('useAddParticipantContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        multisigCheckState.data = undefined
        multisigCheckState.isFetching = false
    })

    it('resolves immediately with the address when the user picks a local non-watch account', () => {
        const { result } = renderHook(() => useAddParticipantContent())

        act(() => {
            result.current.handleSelected(LOCAL_ALGO_ADDR, 'alice.algo')
        })

        expect(mockResolve).toHaveBeenCalledWith({
            address: LOCAL_ALGO_ADDR,
            nfdName: 'alice.algo',
        })
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it('shows a watch-account error toast and does not resolve when the user picks a local watch account', () => {
        const { result } = renderHook(() => useAddParticipantContent())

        act(() => {
            result.current.handleSelected(LOCAL_WATCH_ADDR)
        })

        expect(mockResolve).not.toHaveBeenCalled()
        expect(mockErrorToast).toHaveBeenCalledWith(
            'multisig.add_participant.cannot_add_watch_error',
            'multisig.add_participant.cannot_add_watch_error_body',
        )
    })

    it('resolves immediately when the user picks a contact', () => {
        const { result } = renderHook(() => useAddParticipantContent())

        act(() => {
            result.current.handleSelected(CONTACT_ADDR)
        })

        expect(mockResolve).toHaveBeenCalledWith({
            address: CONTACT_ADDR,
            nfdName: undefined,
        })
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it('resolves with an external address once the multisig check confirms it is not a shared account', async () => {
        multisigCheckState.data = { isMultisig: false }
        const { result } = renderHook(() => useAddParticipantContent())

        act(() => {
            result.current.handleSelected(EXTERNAL_ADDR)
        })

        await waitFor(() =>
            expect(mockResolve).toHaveBeenCalledWith({
                address: EXTERNAL_ADDR,
                nfdName: undefined,
            }),
        )
        expect(mockErrorToast).not.toHaveBeenCalled()
    })

    it('shows a multisig-account error toast and does not resolve when the external address is a shared account', async () => {
        multisigCheckState.data = { isMultisig: true }
        const { result } = renderHook(() => useAddParticipantContent())

        act(() => {
            result.current.handleSelected(MULTISIG_ADDR)
        })

        await waitFor(() =>
            expect(mockErrorToast).toHaveBeenCalledWith(
                'multisig.add_participant.cannot_add_multisig_error',
                'multisig.add_participant.cannot_add_multisig_error_body',
            ),
        )
        expect(mockResolve).not.toHaveBeenCalled()
    })

    it('exposes dismiss for the toolbar close button', () => {
        const { result } = renderHook(() => useAddParticipantContent())

        act(() => {
            result.current.dismiss()
        })

        expect(mockDismiss).toHaveBeenCalled()
    })
})
