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

import { render, screen } from '@test-utils/render'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import {
    type Optional,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import { PWText } from '@components/core'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { AddressDisplay } from '../AddressDisplay'

const mockUseAllAccounts = vi.fn(() => [] as unknown[])
let mockContacts: { name: string; addresses: Record<string, string> }[] = []

vi.mock('@perawallet/wallet-core-accounts', () => ({
    findAccountByAddressOn: (
        accounts: { chains: Record<string, { address: string }> }[],
        chainId: string,
        address: string,
    ) => accounts.find(a => a.chains[chainId]?.address === address),
    addressOn: (
        account: { chains: Record<string, { address: string }> },
        scope: { chainId: string },
    ) => account.chains[scope.chainId]?.address,
    useAccountPresentation: () => null,
    useAllAccounts: () => mockUseAllAccounts(),
    useCanSignWith: () => true,
    useDelegatedAccount: () => null,
    useSignerFor: () => null,
    isMultisigAccount: () => false,
    useAuthorityOf: () => null,
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: () => ({ contacts: mockContacts }),
    findContactByAddress: (
        contacts: { addresses: Record<string, string> }[],
        address: string,
    ) =>
        contacts.find(contact =>
            Object.values(contact.addresses).includes(address),
        ),
}))

const mockUseNfdForAddress = vi.fn(() => ({
    data: undefined as Optional<{ name: string }[]>,
    isPending: false,
}))

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdForAddressQuery: (...args: Parameters<typeof mockUseNfdForAddress>) =>
        mockUseNfdForAddress(...args),
}))

describe('AddressDisplay', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
        mockContacts = []
        mockUseNfdForAddress.mockReturnValue({
            data: undefined,
            isPending: false,
        })
    })

    it("resolves names on the address's own chain when given its scope", () => {
        registerEthereumChain()
        onTestFinished(restoreAlgorandOnlyChains)
        const scope = { chainId: 'ethereum', networkId: 'mainnet' } as const

        render(
            <AddressDisplay
                address='0xabc'
                scope={scope}
            />,
        )

        expect(mockUseNfdForAddress).toHaveBeenCalledWith(
            scope,
            '0xabc',
            expect.anything(),
        )
    })

    it("shortens an EVM address with its own chain's rule", () => {
        registerEthereumChain()
        onTestFinished(restoreAlgorandOnlyChains)

        render(
            <AddressDisplay
                address='0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
                scope={{ chainId: 'ethereum', networkId: 'mainnet' }}
            />,
        )

        expect(screen.getByText('0xf39f...2266')).toBeTruthy()
    })

    it('shows a full EVM address in its checksummed form', () => {
        registerEthereumChain()
        onTestFinished(restoreAlgorandOnlyChains)

        render(
            <AddressDisplay
                address='0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
                addressFormat='full'
                scope={{ chainId: 'ethereum', networkId: 'mainnet' }}
            />,
        )

        expect(
            screen.getByText('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
        ).toBeTruthy()
    })

    it('does not resolve NFD when displayType is address-only', () => {
        render(
            <AddressDisplay
                address={'A'.repeat(58)}
                displayType='address-only'
            />,
        )

        expect(mockUseNfdForAddress).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(String),
            expect.objectContaining({ enabled: false }),
        )
    })

    it('renders a matched contact without an image as a person icon, the contact name and the truncated address', () => {
        const address = 'A'.repeat(58)
        mockContacts = [{ name: 'Alice', addresses: { algorand: address } }]

        render(<AddressDisplay address={address} />)

        expect(screen.getByTestId('icon-person')).toBeTruthy()
        expect(screen.getByText('Alice')).toBeTruthy()
        expect(screen.getByText(/AAA/)).toBeTruthy()
    })

    it('renders a person icon avatar for a foreign address when forceShowIcon is set', () => {
        const address = 'B'.repeat(58)

        render(
            <AddressDisplay
                address={address}
                forceShowIcon
            />,
        )

        expect(screen.getByTestId('icon-person')).toBeTruthy()
    })

    it('renders the NFD name with a person icon and the truncated address as a secondary line', () => {
        mockUseNfdForAddress.mockReturnValue({
            data: [{ name: 'alice.algo' }],
            isPending: false,
        })

        render(<AddressDisplay address={'C'.repeat(58)} />)

        expect(screen.getByTestId('icon-person')).toBeTruthy()
        expect(screen.getByText('alice.algo')).toBeTruthy()
        expect(screen.getByText(/CCC/)).toBeTruthy()
    })

    it('renders only the truncated address when no NFD resolves for a foreign address', () => {
        const address = 'D'.repeat(58)
        render(<AddressDisplay address={address} />)

        const matches = screen.getAllByText(/DDD/)
        expect(matches).toHaveLength(1)
    })

    it('renders only the contact name when it equals the truncated address', () => {
        const address = 'A'.repeat(58)
        const truncated = truncateAlgorandAddress(address)
        mockContacts = [{ name: truncated, addresses: { algorand: address } }]

        render(<AddressDisplay address={address} />)

        // showSecondary is false: the redundant second line is collapsed.
        expect(screen.getAllByText(truncated)).toHaveLength(1)
    })

    it('renders the trailing node and not the copy icon, taking precedence over showCopy', () => {
        render(
            <AddressDisplay
                address={'D'.repeat(58)}
                showCopy
                trailing={<PWText testID='trailing-slot'>edit</PWText>}
            />,
        )

        expect(screen.getByTestId('trailing-slot')).toBeTruthy()
        expect(screen.queryByTestId('icon-copy')).toBeNull()
    })

    it('forwards arbitrary textProps to the contact name text', () => {
        const address = 'A'.repeat(58)
        mockContacts = [{ name: 'Alice', addresses: { algorand: address } }]

        render(
            <AddressDisplay
                address={address}
                textProps={{ testID: 'addr-primary' }}
            />,
        )

        expect(screen.getByTestId('addr-primary')).toBeTruthy()
    })

    describe('unified layout', () => {
        it('renders only the truncated address when no NFD, contact or local account matches', () => {
            const address = 'ABCDEFGHIJ1234567890KLMNOPQRST'
            render(
                <AddressDisplay
                    address={address}
                    iconName='accounts/light/multisig-account'
                    showSecondaryAddress
                />,
            )

            const matches = screen.getAllByText(/ABC/)
            expect(matches).toHaveLength(1)
        })

        it('renders NFD name as primary with truncated address as secondary', () => {
            mockUseNfdForAddress.mockReturnValue({
                data: [{ name: 'alice.algo' }],
                isPending: false,
            })

            const address = 'ABCDEFGHIJ1234567890KLMNOPQRST'
            render(
                <AddressDisplay
                    address={address}
                    iconName='accounts/light/multisig-account'
                    showSecondaryAddress
                />,
            )

            expect(screen.getByText('alice.algo')).toBeTruthy()
            expect(screen.getByText(/ABC/)).toBeTruthy()
        })

        it('renders truncated address as primary and contact name as secondary when the address matches a contact', () => {
            const address = 'ABCDEFGHIJ1234567890KLMNOPQRST'
            mockContacts = [
                { name: 'Joseph', addresses: { algorand: address } },
            ]

            render(
                <AddressDisplay
                    address={address}
                    iconName='accounts/light/multisig-account'
                    showSecondaryAddress
                />,
            )

            expect(screen.getByText('Joseph')).toBeTruthy()
            expect(screen.getByText(/ABC/)).toBeTruthy()
        })

        it('renders the truncated address when the address matches a local account', () => {
            const address = 'ABCDEFGHIJ1234567890KLMNOPQRST'
            mockUseAllAccounts.mockReturnValue([
                {
                    name: 'My Wallet',
                    chains: { algorand: { address } },
                    custody: { kind: 'watch' },
                },
            ])

            render(
                <AddressDisplay
                    address={address}
                    iconName='accounts/light/multisig-account'
                    showSecondaryAddress
                />,
            )

            expect(screen.getByText(/ABC/)).toBeTruthy()
            expect(screen.queryByText('My Wallet')).toBeNull()
        })

        it('prefers contact name over NFD when both match the same address', () => {
            const address = 'ABCDEFGHIJ1234567890KLMNOPQRST'
            mockContacts = [
                { name: 'Joseph', addresses: { algorand: address } },
            ]
            mockUseNfdForAddress.mockReturnValue({
                data: [{ name: 'alice.algo' }],
                isPending: false,
            })

            render(
                <AddressDisplay
                    address={address}
                    iconName='accounts/light/multisig-account'
                    showSecondaryAddress
                />,
            )

            expect(screen.getByText('Joseph')).toBeTruthy()
            expect(screen.queryByText('alice.algo')).toBeNull()
        })

        it('prefers the truncated address over NFD and contact matches for a local account', () => {
            const address = 'ABCDEFGHIJ1234567890KLMNOPQRST'
            mockUseAllAccounts.mockReturnValue([
                {
                    name: 'My Wallet',
                    chains: { algorand: { address } },
                    custody: { kind: 'watch' },
                },
            ])
            mockUseNfdForAddress.mockReturnValue({
                data: [{ name: 'alice.algo' }],
                isPending: false,
            })
            mockContacts = [
                { name: 'Joseph', addresses: { algorand: address } },
            ]

            render(
                <AddressDisplay
                    address={address}
                    iconName='accounts/light/multisig-account'
                    showSecondaryAddress
                />,
            )

            expect(screen.getByText(/ABC/)).toBeTruthy()
            expect(screen.queryByText('alice.algo')).toBeNull()
            expect(screen.queryByText('Joseph')).toBeNull()
        })
    })
})
