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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSelectedAccount } from '../useSelectedAccount'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'

vi.mock('../../store', async () => {
    const actual =
        await vi.importActual<typeof import('../../store')>('../../store')
    const mockStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    }
    return {
        ...actual,
        useAccountsStore: actual.createAccountsStore(mockStorage as any),
    }
})

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useKeyValueStorageService: vi.fn().mockReturnValue({
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    }),
}))

describe('useSelectedAccount', () => {
    beforeEach(() => {
        useAccountsStore.setState({
            accounts: [],
            selectedAccountAddress: null,
        })
    })

    test('returns selected account', () => {
        const accounts: WalletAccount[] = [
            {
                id: '1',
                address: 'A',
                type: 'standard',
                canSign: true,
                name: 'A',
            },
            {
                id: '2',
                address: 'B',
                type: 'standard',
                canSign: true,
                name: 'B',
            },
        ]
        useAccountsStore.setState({ accounts, selectedAccountAddress: 'B' })

        const { result } = renderHook(() => useSelectedAccount())
        expect(result.current).toEqual(accounts[1])
    })

    test('returns null if no selection', () => {
        const { result } = renderHook(() => useSelectedAccount())
        expect(result.current).toBeNull()
    })
})
