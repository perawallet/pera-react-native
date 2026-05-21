/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { type Optional } from '@perawallet/wallet-core-shared'
import { AddressDisplay } from '../AddressDisplay'

const mockUseAllAccounts = vi.fn(() => [] as unknown[])
const mockFindContacts = vi.fn(() => [] as unknown[])

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => mockUseAllAccounts(),
    useCanSignWith: () => true,
    useRekeyAccount: () => null,
    useSignerFor: () => null,
    AccountTypes: {
        algo25: 'algo25',
        hdWallet: 'hdWallet',
        hardware: 'hardware',
        multisig: 'multisig',
        watch: 'watch',
    },
    isMultisigAccount: () => false,
    isRekeyedAccount: (account: { rekeyAddress?: string } | null | undefined) =>
        !!account?.rekeyAddress,
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: () => ({ findContacts: mockFindContacts }),
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
        mockFindContacts.mockReturnValue([])
        mockUseNfdForAddress.mockReturnValue({
            data: undefined,
            isPending: false,
        })
    })

    it('renders correctly with address', () => {
        const address = 'ABCDEFGHIJ1234567890'
        render(<AddressDisplay address={address} />)

        expect(screen.getByText(/ABC/)).toBeTruthy()
    })

    it('renders NFD name when resolved', () => {
        mockUseNfdForAddress.mockReturnValue({
            data: [{ name: 'alice.algo' }],
            isPending: false,
        })

        render(<AddressDisplay address={'A'.repeat(58)} />)

        expect(screen.getByText('alice.algo')).toBeTruthy()
    })

    it('renders truncated address when no NFD found', () => {
        mockUseNfdForAddress.mockReturnValue({
            data: undefined,
            isPending: false,
        })

        const address = 'ABCDEFGHIJ1234567890'
        render(<AddressDisplay address={address} />)

        expect(screen.getByText(/ABC/)).toBeTruthy()
    })

    it('does not resolve NFD when displayType is address-only', () => {
        render(
            <AddressDisplay
                address={'A'.repeat(58)}
                displayType='address-only'
            />,
        )

        expect(mockUseNfdForAddress).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ enabled: false }),
        )
    })

    it('renders the default contact avatar (person icon) for a matched contact without an image', () => {
        mockFindContacts.mockReturnValue([
            {
                name: 'Alice',
                address: 'A'.repeat(58),
            },
        ])

        render(<AddressDisplay address={'A'.repeat(58)} />)

        expect(screen.getByTestId('icon-person')).toBeTruthy()
        expect(screen.getByText('Alice')).toBeTruthy()
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

    it('renders a person icon avatar for an NFD-resolved foreign address', () => {
        mockUseNfdForAddress.mockReturnValue({
            data: [{ name: 'alice.algo' }],
            isPending: false,
        })

        render(<AddressDisplay address={'C'.repeat(58)} />)

        expect(screen.getByTestId('icon-person')).toBeTruthy()
        expect(screen.getByText('alice.algo')).toBeTruthy()
    })

    it('renders the truncated address as a secondary line when an NFD resolves', () => {
        mockUseNfdForAddress.mockReturnValue({
            data: [{ name: 'alice.algo' }],
            isPending: false,
        })

        render(<AddressDisplay address={'C'.repeat(58)} />)

        expect(screen.getByText('alice.algo')).toBeTruthy()
        expect(screen.getByText(/CCC/)).toBeTruthy()
    })

    it('renders only the truncated address when no NFD resolves for a foreign address', () => {
        const address = 'D'.repeat(58)
        render(<AddressDisplay address={address} />)

        const matches = screen.getAllByText(/DDD/)
        expect(matches).toHaveLength(1)
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
            mockFindContacts.mockReturnValue([{ name: 'Joseph', address }])

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

        it('renders the "(You)" label when the address matches a local account', () => {
            const address = 'ABCDEFGHIJ1234567890KLMNOPQRST'
            mockUseAllAccounts.mockReturnValue([{ name: 'My Wallet', address }])

            render(
                <AddressDisplay
                    address={address}
                    iconName='accounts/light/multisig-account'
                    showSecondaryAddress
                />,
            )

            expect(screen.getByText('address_display.you_suffix')).toBeTruthy()
            expect(screen.queryByText('My Wallet')).toBeNull()
        })

        it('prefers contact name over NFD when both match the same address', () => {
            const address = 'ABCDEFGHIJ1234567890KLMNOPQRST'
            mockFindContacts.mockReturnValue([{ name: 'Joseph', address }])
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

        it('prefers the "(You)" label over NFD and contact matches', () => {
            const address = 'ABCDEFGHIJ1234567890KLMNOPQRST'
            mockUseAllAccounts.mockReturnValue([{ name: 'My Wallet', address }])
            mockUseNfdForAddress.mockReturnValue({
                data: [{ name: 'alice.algo' }],
                isPending: false,
            })
            mockFindContacts.mockReturnValue([{ name: 'Joseph', address }])

            render(
                <AddressDisplay
                    address={address}
                    iconName='accounts/light/multisig-account'
                    showSecondaryAddress
                />,
            )

            expect(screen.getByText('address_display.you_suffix')).toBeTruthy()
            expect(screen.queryByText('alice.algo')).toBeNull()
            expect(screen.queryByText('Joseph')).toBeNull()
        })
    })
})
