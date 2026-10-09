/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSigningAccounts } from '../useSigningAccounts'
import { useAccountsStore } from '../../store'
import { registerFakeAccountsChain } from '../../__tests__/fakeAccountsChain'

vi.mock('../../store', () => ({
    useAccountsStore: vi.fn(),
    useAccountChainStateStore: (selector: any) => selector({ states: {} }),
}))

describe('useSigningAccounts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerFakeAccountsChain()
    })

    it('should return only accounts that can sign', () => {
        const mockAccounts = [
            {
                address: 'addr1',
                custody: { kind: 'local', seed: null },
                keyPairId: 'pk1',
            },
            { address: 'addr2', custody: { kind: 'watch' } },
            {
                address: 'addr3',
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
                keyPairId: 'pk3',
            },
        ]

        ;(useAccountsStore as any).mockImplementation((selector: any) =>
            selector({ accounts: mockAccounts }),
        )

        const { result } = renderHook(() => useSigningAccounts())

        expect(result.current).toEqual([
            {
                address: 'addr1',
                custody: { kind: 'local', seed: null },
                keyPairId: 'pk1',
            },
            {
                address: 'addr3',
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
                keyPairId: 'pk3',
            },
        ])
    })

    it('should return empty array if no accounts can sign', () => {
        const mockAccounts = [
            { address: 'addr1', custody: { kind: 'watch' } },
            { address: 'addr2', custody: { kind: 'watch' } },
        ]

        ;(useAccountsStore as any).mockImplementation((selector: any) =>
            selector({ accounts: mockAccounts }),
        )

        const { result } = renderHook(() => useSigningAccounts())

        expect(result.current).toEqual([])
    })

    it('should return empty array if there are no accounts', () => {
        const mockAccounts: any[] = []

        ;(useAccountsStore as any).mockImplementation((selector: any) =>
            selector({ accounts: mockAccounts }),
        )

        const { result } = renderHook(() => useSigningAccounts())

        expect(result.current).toEqual([])
    })
})
