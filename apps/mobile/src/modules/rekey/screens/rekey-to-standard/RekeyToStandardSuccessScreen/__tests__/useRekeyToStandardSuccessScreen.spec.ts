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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
    getAccountDisplayName,
    useFindAccountByAddress,
} from '@perawallet/wallet-core-accounts'
import { useRekeyToStandardSuccessScreen } from '../useRekeyToStandardSuccessScreen'

const mockNavigate = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        navigate: mockNavigate,
    }),
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: () => ({
        params: { sourceAddress: 'SRC_ADDR' },
    }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useFindAccountByAddress: vi.fn(() => ({ name: 'Wallet A' })),
    getAccountDisplayName: vi.fn(
        (account: { name: string } | undefined) => account?.name ?? '',
    ),
}))

describe('useRekeyToStandardSuccessScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useFindAccountByAddress).mockReturnValue({
            name: 'Wallet A',
        } as ReturnType<typeof useFindAccountByAddress>)
        vi.mocked(getAccountDisplayName).mockImplementation(
            account => (account as { name?: string } | undefined)?.name ?? '',
        )
    })

    it('returns the account name as sourceName when the account is found', () => {
        const { result } = renderHook(() => useRekeyToStandardSuccessScreen())

        expect(result.current.sourceName).toBe('Wallet A')
    })

    it('returns an empty string as sourceName when the account is not found', () => {
        vi.mocked(useFindAccountByAddress).mockReturnValueOnce(
            undefined as unknown as ReturnType<typeof useFindAccountByAddress>,
        )

        const { result } = renderHook(() => useRekeyToStandardSuccessScreen())

        expect(result.current.sourceName).toBe('')
    })

    it('handleDone navigates to the Home tab', () => {
        const { result } = renderHook(() => useRekeyToStandardSuccessScreen())

        act(() => {
            result.current.handleDone()
        })

        expect(mockNavigate).toHaveBeenCalledWith('TabBar', { screen: 'Home' })
    })
})
