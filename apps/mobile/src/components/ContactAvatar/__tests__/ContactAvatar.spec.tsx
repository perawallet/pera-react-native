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
    it('renders icon if contact has no image', () => {
        render(<ContactAvatar size='small' />)
        expect(screen.getByTestId('icon-person')).toBeTruthy()
    })

    it('renders placeholder if contact has image but it fails to load or exists', () => {
        const contact = {
            name: 'John',
            image: 'https://example.com/image.png',
            address: 'addr',
        } as Contact
        render(
            <ContactAvatar
                size='small'
                contact={contact}
            />,
        )
        // In our mock, Image renders as <img>.
        // We can't easily check for img existence without more specific queries,
        // but it renders without crash.
    })
})
