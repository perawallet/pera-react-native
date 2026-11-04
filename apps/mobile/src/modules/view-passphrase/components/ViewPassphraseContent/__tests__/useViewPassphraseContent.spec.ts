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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

type TestAccount = { id: string; chains: Record<string, { address: string }> }

const accounts = vi.hoisted(() => ({ current: [] as unknown[] }))
const mockUseMnemonicForAddress = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: (selector: (state: unknown) => unknown) =>
        selector({ accounts: accounts.current }),
    findAccountByAnyChainAddress: (list: TestAccount[], address: string) =>
        list.find(a =>
            Object.values(a.chains).some(entry => entry.address === address),
        ),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    zeroBytes: (buffer: Uint16Array | null) => buffer?.fill(0),
}))

vi.mock('@modules/backup', () => ({
    useMnemonicForAddress: mockUseMnemonicForAddress,
}))

import { useViewPassphraseContent } from '../useViewPassphraseContent'

describe('useViewPassphraseContent', () => {
    beforeEach(() => {
        mockUseMnemonicForAddress.mockReset()
        mockUseMnemonicForAddress.mockReturnValue({
            executeWithMnemonic: () => Promise.resolve(),
        })
    })

    it('finds an account on two chains by its address on the second', async () => {
        const both: TestAccount = {
            id: 'both',
            chains: {
                algorand: { address: 'ALGO_ADDR' },
                ethereum: { address: '0xETH_ADDR' },
            },
        }
        accounts.current = [both]

        const { result } = renderHook(() =>
            useViewPassphraseContent({ address: '0xETH_ADDR' }),
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(mockUseMnemonicForAddress).toHaveBeenCalledWith(
            '0xETH_ADDR',
            both,
        )
    })
})
