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

const { state, mockNavigateToScreen, mockNavigateHome } = vi.hoisted(() => ({
    state: { needing: [] as { id: string; address: string }[] },
    mockNavigateToScreen: vi.fn(),
    mockNavigateHome: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAccountsStore: (selector: (s: { accounts: unknown[] }) => unknown) =>
        selector({ accounts: [] }),
    addressOn: (account: { address: string }) => account.address,
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    useAccountsNeedingMnemonicBackup: () => ({
        accounts: state.needing,
        isPending: false,
    }),
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
        mockNavigateToScreen.mockClear()
        mockNavigateHome.mockClear()
    })

    it('opens the backup of the first account that needs one', () => {
        state.needing = [
            { id: '1', address: 'FIRST' },
            { id: '2', address: 'SECOND' },
        ]
        const { result } = renderHook(() => usePassphraseBackupDeeplink())

        result.current(false)

        expect(mockNavigateToScreen).toHaveBeenCalledWith(
            false,
            'BackupWallet',
            { screen: 'BackupInfo', params: { address: 'FIRST' } },
        )
    })

    // The widget may still show a count the user has since cleared.
    it('lands home when nothing needs a backup anymore', () => {
        state.needing = []
        const { result } = renderHook(() => usePassphraseBackupDeeplink())

        result.current(true)

        expect(mockNavigateHome).toHaveBeenCalledWith(true)
        expect(mockNavigateToScreen).not.toHaveBeenCalled()
    })
})
