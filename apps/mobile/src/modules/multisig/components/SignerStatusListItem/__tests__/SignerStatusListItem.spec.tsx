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
import { describe, expect, it, vi } from 'vitest'
import { SignerStatusListItem } from '../SignerStatusListItem'

vi.mock('@components/AddressDisplay', () => ({
    AddressDisplay: () => null,
}))

const ADDRESS = 'QHCBHSCRDDOQGTAHQHCBHSCRDDOQGTAHQHCBHSCRDDOQGTAHQHCBHSCR'

describe('SignerStatusListItem', () => {
    it('renders a check icon when the signer has signed', () => {
        render(
            <SignerStatusListItem
                address={ADDRESS}
                status='signed'
            />,
        )

        expect(
            screen.getByTestId(`signer_status_icon_signed_${ADDRESS}`),
        ).toBeTruthy()
    })

    it('renders a cross icon when the signer declined', () => {
        render(
            <SignerStatusListItem
                address={ADDRESS}
                status='declined'
            />,
        )

        expect(
            screen.getByTestId(`signer_status_icon_declined_${ADDRESS}`),
        ).toBeTruthy()
    })

    it('renders a spinner when the signer is pending', () => {
        render(
            <SignerStatusListItem
                address={ADDRESS}
                status='pending'
            />,
        )

        expect(
            screen.getByTestId(`signer_status_icon_pending_${ADDRESS}`),
        ).toBeTruthy()
    })

    it('renders a neutral icon when the signer is unsigned', () => {
        render(
            <SignerStatusListItem
                address={ADDRESS}
                status='unsigned'
            />,
        )

        expect(
            screen.getByTestId(`signer_status_icon_unsigned_${ADDRESS}`),
        ).toBeTruthy()
    })
})
