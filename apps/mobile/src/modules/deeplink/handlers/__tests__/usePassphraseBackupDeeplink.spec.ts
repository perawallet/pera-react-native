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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePassphraseBackupDeeplink } from '../usePassphraseBackupDeeplink'

const { state, mockFind, mockNavigateToScreen, mockNavigateHome } = vi.hoisted(
    () => ({
        state: { accounts: [{ id: 'stored' }] as unknown[] },
        mockFind: vi.fn(),
        mockNavigateToScreen: vi.fn(),
        mockNavigateHome: vi.fn(),
    }),
)

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => 'query-client',
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    getAllAccounts: () => state.accounts,
    addressOn: (account: { address: string }) => account.address,
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    findAccountsNeedingMnemonicBackup: mockFind,
}))

vi.mock('@hooks/useCapableChainIds', () => ({
    useCapableChainId: () => 'algorand',
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useSelectedScope: (chainId: string) => ({ chainId, networkId: 'mainnet' }),
}))

vi.mock('../../navigateToScreen', () => ({
    navigateToScreen: mockNavigateToScreen,
    navigateHome: mockNavigateHome,
}))

describe('usePassphraseBackupDeeplink', () => {
    beforeEach(() => {
        mockFind.mockReset()
        mockNavigateToScreen.mockClear()
        mockNavigateHome.mockClear()
    })

    it('opens the backup of the first account that needs one', async () => {
        mockFind.mockResolvedValue([
            { id: '1', address: 'FIRST' },
            { id: '2', address: 'SECOND' },
        ])
        const { result } = renderHook(() => usePassphraseBackupDeeplink())

        await result.current(false)

        expect(mockFind).toHaveBeenCalledWith('query-client', state.accounts, {
            chainId: 'algorand',
            networkId: 'mainnet',
        })
        expect(mockNavigateToScreen).toHaveBeenCalledWith(
            false,
            'BackupWallet',
            { screen: 'BackupInfo', params: { address: 'FIRST' } },
        )
    })

    // On a cold start from the widget the funding reads are still running;
    // deciding before they settle would land home with backups still due.
    it('waits for the funding reads before deciding', async () => {
        let settle: (accounts: unknown[]) => void = () => {}
        mockFind.mockReturnValue(
            new Promise(resolve => {
                settle = resolve
            }),
        )
        const { result } = renderHook(() => usePassphraseBackupDeeplink())

        const handled = result.current(false)
        await Promise.resolve()
        expect(mockNavigateHome).not.toHaveBeenCalled()
        expect(mockNavigateToScreen).not.toHaveBeenCalled()

        settle([{ id: '1', address: 'FIRST' }])
        await handled

        expect(mockNavigateHome).not.toHaveBeenCalled()
        expect(mockNavigateToScreen).toHaveBeenCalledWith(
            false,
            'BackupWallet',
            { screen: 'BackupInfo', params: { address: 'FIRST' } },
        )
    })

    // The widget may still show a count the user has since cleared.
    it('lands home when nothing needs a backup anymore', async () => {
        mockFind.mockResolvedValue([])
        const { result } = renderHook(() => usePassphraseBackupDeeplink())

        await result.current(true)

        expect(mockNavigateHome).toHaveBeenCalledWith(true)
        expect(mockNavigateToScreen).not.toHaveBeenCalled()
    })
})
