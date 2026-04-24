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
import { AddContactScreen } from '../AddContactScreen'

vi.mock('@perawallet/wallet-core-contacts', async () => ({
    useContacts: vi.fn(() => ({
        selectedContact: null,
        saveContact: vi.fn(),
        deleteContact: vi.fn(),
        findContacts: vi.fn(() => []),
        setSelectedContact: vi.fn(),
    })),
    contactSchema: {},
}))

vi.mock('@hooks/useImagePicker', () => ({
    useImagePicker: () => ({
        pickFromGallery: vi.fn(),
        permissionDenied: {
            isVisible: false,
            close: vi.fn(),
            openSettings: vi.fn(),
        },
    }),
}))

vi.mock('@hookform/resolvers/zod', () => ({ zodResolver: vi.fn() }))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    isValidAlgorandAddress: vi.fn(() => false),
}))

vi.mock('@perawallet/wallet-core-nfd', () => ({
    useNfdSearchQuery: vi.fn(() => ({ data: [], isLoading: false })),
}))

vi.mock('@hooks/useDebouncedValue', () => ({
    useDebouncedValue: (value: string) => value,
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        truncateAlgorandAddress: (addr: string) =>
            addr.substring(0, 10) + '...',
    }
})

vi.mock('react-hook-form', () => ({
    useForm: () => ({
        control: {},
        handleSubmit: (fn: (data: unknown) => void) => fn,
        setError: vi.fn(),
        setValue: vi.fn(),
        watch: vi.fn(() => ''),
        formState: { isValid: false, errors: {} },
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
}))

describe('AddContactScreen', () => {
    it('renders the Add contact CTA', () => {
        render(<AddContactScreen />)
        expect(
            screen.getByText('contacts.edit_contact.add_contact'),
        ).toBeTruthy()
    })
})
