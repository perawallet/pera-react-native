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
import { renderHook } from '@testing-library/react'
import { useSharedAccountDetailsContent } from '../useSharedAccountDetailsContent'

const mockAccounts = vi.fn<() => { address: string }[]>(() => [])

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-accounts')
    >('@perawallet/wallet-core-accounts')
    return {
        ...actual,
        useAllAccounts: () => mockAccounts(),
    }
})

describe('useSharedAccountDetailsContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAccounts.mockReturnValue([])
    })

    it('isUserIncluded is true when a wallet account is a participant', () => {
        mockAccounts.mockReturnValue([{ address: 'ADDR1' }])

        const { result } = renderHook(() =>
            useSharedAccountDetailsContent(['ADDR1', 'ADDR2']),
        )

        expect(result.current.isUserIncluded).toBe(true)
    })

    it('isUserIncluded is false when no wallet account is a participant', () => {
        mockAccounts.mockReturnValue([{ address: 'OTHER' }])

        const { result } = renderHook(() =>
            useSharedAccountDetailsContent(['ADDR1', 'ADDR2']),
        )

        expect(result.current.isUserIncluded).toBe(false)
    })

    it('isUserIncluded is false when there are no participant addresses', () => {
        mockAccounts.mockReturnValue([{ address: 'ADDR1' }])

        const { result } = renderHook(() => useSharedAccountDetailsContent([]))

        expect(result.current.isUserIncluded).toBe(false)
    })
})
