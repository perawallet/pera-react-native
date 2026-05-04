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

import { describe, test, expect, vi } from 'vitest'
import React from 'react'
import { render, act } from '@test-utils/render'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useMnemonicBackupStore,
    useMarkMnemonicBackupComplete,
    useRequiresMnemonicBackup,
} from '@perawallet/wallet-core-backup'

const hd = (address: string, keyIndex: number): WalletAccount => ({
    type: AccountTypes.hdWallet,
    address,
    // All siblings share the same root (keyPairId), which keys their backup
    // state — see getMnemonicBackupKeyId.
    keyPairId: 'shared-root',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex,
        derivationType: 9,
    },
})

const accounts = [hd('HD1', 0), hd('HD2', 1), hd('HD3', 2)]

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        useAccountsStore: (
            selector: (state: { accounts: WalletAccount[] }) => unknown,
        ) => selector({ accounts }),
    }
})

describe('Backup flow - HD sibling dedup', () => {
    test('marking one HD account backed up flags every sibling sharing the wallet root', () => {
        useMnemonicBackupStore.getState().resetState()

        let mark: ((acc: WalletAccount) => void) | undefined
        const sibling1Requires: boolean[] = []
        const sibling2Requires: boolean[] = []

        const Probe = () => {
            mark = useMarkMnemonicBackupComplete()
            sibling1Requires.push(useRequiresMnemonicBackup(accounts[1]))
            sibling2Requires.push(useRequiresMnemonicBackup(accounts[2]))
            return null
        }

        const { rerender } = render(<Probe />)
        expect(sibling1Requires.at(-1)).toBe(true)
        expect(sibling2Requires.at(-1)).toBe(true)

        act(() => {
            mark?.(accounts[0])
        })

        rerender(<Probe />)
        expect(
            useMnemonicBackupStore.getState().isBackedUp('shared-root'),
        ).toBe(true)
        expect(sibling1Requires.at(-1)).toBe(false)
        expect(sibling2Requires.at(-1)).toBe(false)
    })
})
