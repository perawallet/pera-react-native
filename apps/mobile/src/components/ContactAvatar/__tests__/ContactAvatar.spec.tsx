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

import { describe, it, expect } from 'vitest'
import React from 'react'
import { Contact } from '@perawallet/wallet-core-contacts'
import { render, screen } from '@test-utils/render'
import { ContactAvatar } from '../ContactAvatar'

describe('ContactAvatar', () => {
    it('renders the person placeholder icon when no contact is provided', () => {
        render(<ContactAvatar size='sm' />)
        expect(screen.getByTestId('icon-person')).toBeTruthy()
    })

    it('renders the person placeholder icon when the contact has no image', () => {
        const contact: Contact = {
            name: 'John',
            address: 'addr',
        }
        render(
            <ContactAvatar
                size='md'
                contact={contact}
            />,
        )
        expect(screen.getByTestId('icon-person')).toBeTruthy()
    })

    it('renders the contact image when one is provided, not the fallback icon', () => {
        const contact: Contact = {
            name: 'John',
            image: 'https://example.com/image.png',
            address: 'addr',
        }
        render(
            <ContactAvatar
                size='md'
                contact={contact}
            />,
        )
        // PWImage mock in vitest.setup renders as <img>; when a valid image
        // source is supplied we should NOT fall through to the placeholder.
        expect(screen.queryByTestId('icon-person')).toBeNull()
    })
})
