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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
    CUSTOM_NETWORK_ID,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    getChainDescriptor,
    getSelectedScope,
    useNetworkStore,
} from '@perawallet/wallet-core-chain-shared'
import { type Contact, useContacts } from '@perawallet/wallet-core-contacts'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { evmChainOf } from '@packages/chain-ethereum/src/chains/table'
import { evmCapabilityDefaults } from '@packages/chain-ethereum/src/capability-defaults'
import { setChainEnabled } from '@test-utils/capability-overrides'
import {
    ETHEREUM_CHAIN_ID,
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'

import { useViewContactScreen } from '../useViewContactScreen'

const mocks = vi.hoisted(() => ({
    navigate: vi.fn(),
    requestBottomSheet: vi.fn(),
    shareText: vi.fn(),
    useNfdForAddressQuery: vi.fn(),
    copyToClipboard: vi.fn(),
    pushWebView: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdForAddressQuery: mocks.useNfdForAddressQuery,
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.requestBottomSheet }),
}))

vi.mock('@modules/contacts/components/ContactQRContent', () => ({
    ContactQRContent: () => null,
}))

vi.mock('@modules/contacts/components/ContactNetworkContent', () => ({
    ContactNetworkContent: () => null,
}))

vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: mocks.pushWebView }),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mocks.copyToClipboard }),
}))

vi.mock('@utils/shareText', () => ({
    shareText: mocks.shareText,
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ navigate: mocks.navigate }),
}))

const CONTACT: Contact = {
    id: 'contact-1',
    name: 'Alice',
    addresses: { algorand: 'ALICE_ADDRESS', evm: '0xA11CE' },
}

const BASE_CHAIN_ID: ChainId = 'base'

const accountUrl = (chainId: ChainId, address: string) =>
    getChainDescriptor(chainId).explorer.accountUrl(
        getSelectedScope(chainId).networkId,
        address,
    )

const selectCustomNetwork = (chainId: ChainId): void => {
    const store = useNetworkStore.getState()
    store.setMode('developer')
    store.setCustomNetwork(chainId, { id: CUSTOM_NETWORK_ID })
    store.selectNetwork(chainId, CUSTOM_NETWORK_ID)
}

const registerBaseChain = (): void => {
    const { chains } = getProvider()
    if (!chains.has(BASE_CHAIN_ID)) {
        chains.register(evmChainOf('base').descriptor, evmCapabilityDefaults)
    }
}

const selectContact = (contact: Contact | null): void => {
    vi.mocked(useContacts).mockReturnValue({
        selectedContact: contact,
    } as unknown as ReturnType<typeof useContacts>)
}

describe('useViewContactScreen', () => {
    beforeEach(() => {
        selectContact(CONTACT)
        mocks.useNfdForAddressQuery.mockReturnValue({
            data: [{ name: 'alice.algo' }, { name: 'second.algo' }],
        })
        mocks.shareText.mockResolvedValue(undefined)
        registerEthereumChain()
    })

    afterEach(() => {
        useNetworkStore.getState().resetState()
        useRemoteConfigStore.getState().resetState()
        restoreAlgorandOnlyChains()
    })

    it('lists one row per family, with whether it has an explorer, and the first NFD name of the Algorand address', () => {
        const { result } = renderHook(() => useViewContactScreen())

        expect(result.current.addressRows).toEqual([
            { family: 'algorand', address: 'ALICE_ADDRESS', hasExplorer: true },
            { family: 'evm', address: '0xA11CE', hasExplorer: true },
        ])
        expect(result.current.nfdName).toBe('alice.algo')
        expect(mocks.useNfdForAddressQuery).toHaveBeenCalledWith(
            expect.anything(),
            'ALICE_ADDRESS',
            { enabled: true },
        )
    })

    it("opens the contact QR sheet on the row's family", () => {
        const { result } = renderHook(() => useViewContactScreen())

        act(() => result.current.openQR('evm'))

        expect(mocks.requestBottomSheet).toHaveBeenCalledWith({
            contents: expect.objectContaining({
                props: { contact: CONTACT, initialFamily: 'evm' },
            }),
            options: { size: 'auto', enablePanDownToClose: true },
        })
    })

    it("copies a row's address", () => {
        const { result } = renderHook(() => useViewContactScreen())

        act(() => result.current.copyAddress('0xA11CE'))

        expect(mocks.copyToClipboard).toHaveBeenCalledWith('0xA11CE')
    })

    it('has no explorer for a family with no registered chain', () => {
        restoreAlgorandOnlyChains()
        const { result } = renderHook(() => useViewContactScreen())

        expect(result.current.addressRows).toContainEqual({
            family: 'evm',
            address: '0xA11CE',
            hasExplorer: false,
        })
    })

    it("has no explorer when the family's only chain is on a custom network", () => {
        selectCustomNetwork(ETHEREUM_CHAIN_ID)
        const { result } = renderHook(() => useViewContactScreen())

        expect(result.current.addressRows).toContainEqual({
            family: 'evm',
            address: '0xA11CE',
            hasExplorer: false,
        })
    })

    it("opens the explorer of a family's only chain without asking for a network", async () => {
        const { result } = renderHook(() => useViewContactScreen())

        await act(() => result.current.openExplorer('evm', '0xA11CE'))

        expect(mocks.requestBottomSheet).not.toHaveBeenCalled()
        expect(mocks.pushWebView).toHaveBeenCalledWith({
            url: accountUrl(ETHEREUM_CHAIN_ID, '0xA11CE'),
        })
    })

    describe('when the family has more than one chain', () => {
        beforeEach(() => {
            registerBaseChain()
        })

        it("asks for the network and opens that chain's explorer", async () => {
            mocks.requestBottomSheet.mockResolvedValue(BASE_CHAIN_ID)
            const { result } = renderHook(() => useViewContactScreen())

            await act(() => result.current.openExplorer('evm', '0xA11CE'))

            expect(mocks.requestBottomSheet).toHaveBeenCalledWith({
                contents: expect.objectContaining({
                    props: { chainIds: [ETHEREUM_CHAIN_ID, BASE_CHAIN_ID] },
                }),
                options: {
                    size: 'auto',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            })
            expect(mocks.pushWebView).toHaveBeenCalledWith({
                url: accountUrl(BASE_CHAIN_ID, '0xA11CE'),
            })
        })

        it('leaves a chain on a custom network out, opening the remaining one directly', async () => {
            selectCustomNetwork(ETHEREUM_CHAIN_ID)
            const { result } = renderHook(() => useViewContactScreen())

            await act(() => result.current.openExplorer('evm', '0xA11CE'))

            expect(mocks.requestBottomSheet).not.toHaveBeenCalled()
            expect(mocks.pushWebView).toHaveBeenCalledWith({
                url: accountUrl(BASE_CHAIN_ID, '0xA11CE'),
            })
        })

        it('leaves a switched-off chain out, opening the remaining one directly', async () => {
            setChainEnabled(BASE_CHAIN_ID, false)
            const { result } = renderHook(() => useViewContactScreen())

            await act(() => result.current.openExplorer('evm', '0xA11CE'))

            expect(mocks.requestBottomSheet).not.toHaveBeenCalled()
            expect(mocks.pushWebView).toHaveBeenCalledWith({
                url: accountUrl(ETHEREUM_CHAIN_ID, '0xA11CE'),
            })
        })

        it('hides the explorer when every chain of the family is switched off', () => {
            setChainEnabled(ETHEREUM_CHAIN_ID, false)
            setChainEnabled(BASE_CHAIN_ID, false)
            const { result } = renderHook(() => useViewContactScreen())

            expect(result.current.addressRows).toContainEqual({
                family: 'evm',
                address: '0xA11CE',
                hasExplorer: false,
            })
        })

        it('opens nothing when the network sheet is dismissed', async () => {
            mocks.requestBottomSheet.mockResolvedValue(undefined)
            const { result } = renderHook(() => useViewContactScreen())

            await act(() => result.current.openExplorer('evm', '0xA11CE'))

            expect(mocks.pushWebView).not.toHaveBeenCalled()
        })
    })

    it('navigates to the edit screen', () => {
        const { result } = renderHook(() => useViewContactScreen())

        act(() => result.current.goToEdit())

        expect(mocks.navigate).toHaveBeenCalledWith('EditContact')
    })

    it('shares the contact name and every address', async () => {
        const { result } = renderHook(() => useViewContactScreen())

        await act(() => result.current.handleShare())

        expect(mocks.shareText).toHaveBeenCalledWith({
            title: 'Alice',
            message: 'ALICE_ADDRESS\n0xA11CE',
        })
    })

    it('swallows a cancelled share', async () => {
        mocks.shareText.mockRejectedValue(new Error('cancelled'))
        const { result } = renderHook(() => useViewContactScreen())

        await expect(
            act(() => result.current.handleShare()),
        ).resolves.toBeUndefined()
    })

    describe('when the contact is missing or was deleted', () => {
        beforeEach(() => {
            selectContact(null)
            mocks.useNfdForAddressQuery.mockReturnValue({ data: undefined })
        })

        it('has no rows and skips the NFD lookup', () => {
            const { result } = renderHook(() => useViewContactScreen())

            expect(result.current.addressRows).toEqual([])
            expect(result.current.nfdName).toBeUndefined()
            expect(mocks.useNfdForAddressQuery).toHaveBeenCalledWith(
                expect.anything(),
                '',
                { enabled: false },
            )
        })

        it('opens no QR sheet', () => {
            const { result } = renderHook(() => useViewContactScreen())

            act(() => result.current.openQR('algorand'))

            expect(mocks.requestBottomSheet).not.toHaveBeenCalled()
        })

        it('shares nothing', async () => {
            const { result } = renderHook(() => useViewContactScreen())

            await act(() => result.current.handleShare())

            expect(mocks.shareText).not.toHaveBeenCalled()
        })
    })
})
