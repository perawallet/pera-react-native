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

import { renderHook, act } from '@testing-library/react-native'
import { useDeleteAllData } from '../delete-all-data'
import {
    useAllAccounts,
    useRemoveAccountById,
} from '@perawallet/wallet-core-accounts'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useQueryClient } from '@tanstack/react-query'

jest.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: jest.fn(),
    useRemoveAccountById: jest.fn(),
}))

jest.mock('@perawallet/wallet-core-contacts', () => ({
    useContacts: jest.fn(),
}))

jest.mock('@perawallet/wallet-core-settings', () => ({
    usePreferences: jest.fn(),
}))

jest.mock('@tanstack/react-query', () => ({
    useQueryClient: jest.fn(),
}))

describe('useDeleteAllData', () => {
    const mockRemoveAccountById = jest.fn()
    const mockDeleteContact = jest.fn()
    const mockClearAllPreferences = jest.fn()
    const mockRemoveQueries = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
        ;(useAllAccounts as jest.Mock).mockReturnValue([
            { id: 'account-1' },
            { id: 'account-2' },
        ])
        ;(useRemoveAccountById as jest.Mock).mockReturnValue(
            mockRemoveAccountById,
        )
        ;(useContacts as jest.Mock).mockReturnValue({
            contacts: ['contact-1', 'contact-2'],
            deleteContact: mockDeleteContact,
        })
        ;(usePreferences as jest.Mock).mockReturnValue({
            clearAllPreferences: mockClearAllPreferences,
        })
        ;(useQueryClient as jest.Mock).mockReturnValue({
            removeQueries: mockRemoveQueries,
        })
    })

    it('should delete all accounts, contacts, preferences and queries', () => {
        const { result } = renderHook(() => useDeleteAllData())

        act(() => {
            result.current()
        })

        expect(mockRemoveAccountById).toHaveBeenCalledTimes(2)
        expect(mockRemoveAccountById).toHaveBeenCalledWith('account-1')
        expect(mockRemoveAccountById).toHaveBeenCalledWith('account-2')

        expect(mockDeleteContact).toHaveBeenCalledTimes(2)
        expect(mockDeleteContact).toHaveBeenCalledWith('contact-1')
        expect(mockDeleteContact).toHaveBeenCalledWith('contact-2')

        expect(mockRemoveQueries).toHaveBeenCalledTimes(1)
        expect(mockClearAllPreferences).toHaveBeenCalledTimes(1)
    })

    it('should not call removeAccountById if account id is missing', () => {
        ;(useAllAccounts as jest.Mock).mockReturnValue([{ id: undefined }])

        const { result } = renderHook(() => useDeleteAllData())

        act(() => {
            result.current()
        })

        expect(mockRemoveAccountById).not.toHaveBeenCalled()
    })
})
