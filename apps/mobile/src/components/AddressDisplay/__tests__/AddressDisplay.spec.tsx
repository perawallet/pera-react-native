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
import { AddressDisplay } from '../AddressDisplay'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: vi.fn(() => []),
}))

vi.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: vi.fn(() => ({
        findContacts: vi.fn(() => []),
    })),
}))

const mockUseNfdForAddress = vi.fn(() => ({
    nfdName: undefined as string | undefined,
    isResolving: false,
}))

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdForAddress: (...args: Parameters<typeof mockUseNfdForAddress>) =>
        mockUseNfdForAddress(...args),
}))

describe('AddressDisplay', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseNfdForAddress.mockReturnValue({
            nfdName: undefined,
            isResolving: false,
        })
    })

    it('renders correctly with address', () => {
        const address = 'ABCDEFGHIJ1234567890'
        render(<AddressDisplay address={address} />)

        expect(screen.getByText(/ABC/)).toBeTruthy()
    })

    it('renders NFD name when resolved', () => {
        mockUseNfdForAddress.mockReturnValue({
            nfdName: 'alice.algo',
            isResolving: false,
        })

        render(<AddressDisplay address={'A'.repeat(58)} />)

        expect(screen.getByText('alice.algo')).toBeTruthy()
    })

    it('renders truncated address when no NFD found', () => {
        mockUseNfdForAddress.mockReturnValue({
            nfdName: undefined,
            isResolving: false,
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
})
