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
import type { Contact } from '@perawallet/wallet-core-contacts'
import { AddressDisplay } from '../AddressDisplay'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(() => []),
}))

const findContactsMock = vi.fn<() => Contact[]>(() => [])

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: vi.fn(() => ({
        findContacts: findContactsMock,
    })),
}))

const mockUseNfdForAddress = vi.fn(() => ({
    data: undefined as { name: string }[] | undefined,
    isPending: false,
}))

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdForAddressQuery: (...args: Parameters<typeof mockUseNfdForAddress>) =>
        mockUseNfdForAddress(...args),
}))

describe('AddressDisplay', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        findContactsMock.mockReturnValue([])
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
        findContactsMock.mockReturnValue([
            {
                name: 'Alice',
                address: 'A'.repeat(58),
            },
        ])

        render(<AddressDisplay address={'A'.repeat(58)} />)

        expect(screen.getByTestId('icon-person')).toBeTruthy()
        expect(screen.getByText('Alice')).toBeTruthy()
    })
})
