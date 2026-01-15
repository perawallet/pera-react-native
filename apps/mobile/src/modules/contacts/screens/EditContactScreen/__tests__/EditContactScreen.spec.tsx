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

import React, { ReactNode } from 'react'
import { render, screen } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import { EditContactScreen } from '../EditContactScreen'

vi.mock('@perawallet/wallet-core-contacts', async () => ({
    useContacts: vi.fn(() => ({
        selectedContact: null,
        saveContact: vi.fn(),
        deleteContact: vi.fn(),
        findContacts: vi.fn(() => []),
    })),
    // Mock schema to avoid parsing issues if needed, but schema is usually an object.
    contactSchema: {},
}))

vi.mock('@hookform/resolvers/zod', () => ({
    zodResolver: vi.fn(),
}))

vi.mock('react-hook-form', () => {
    return {
        useForm: () => ({
            control: {},
            handleSubmit: (fn: (data: unknown) => void) => fn,
            setError: vi.fn(),
            formState: { isValid: true, errors: {} },
        }),
        Controller: ({
            render,
        }: {
            render: (props: {
                field: {
                    onChange: () => void
                    onBlur: () => void
                    value: string
                }
            }) => ReactNode
        }) =>
            render({
                field: { onChange: vi.fn(), onBlur: vi.fn(), value: '' },
            }) as unknown as ReactNode,
    }
})

describe('EditContactScreen', () => {
    it('renders correctly', () => {
        render(<EditContactScreen />)
        expect(screen.getByText('contacts.edit_contact.save')).toBeTruthy()
    })
})
