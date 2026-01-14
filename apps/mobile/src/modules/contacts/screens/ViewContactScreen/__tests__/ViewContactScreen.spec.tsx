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

import { render, screen } from '@testing-library/react-native'
import { describe, it, expect, vi } from 'vitest'
import ViewContactScreen from '../ViewContactScreen'

vi.mock('@perawallet/wallet-core-contacts', async () => ({
    useContacts: vi.fn(() => ({
        selectedContact: { name: 'Test', address: 'test-addr' },
    })),
}))

describe('ViewContactScreen', () => {
    it('renders correctly', () => {
        render(<ViewContactScreen />)
        expect(screen.getByText('Test')).toBeTruthy()
    })
})
