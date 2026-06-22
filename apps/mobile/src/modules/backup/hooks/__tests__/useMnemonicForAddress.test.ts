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

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mockExecuteWithMnemonic = vi.fn()
vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({
        executeWithMnemonic: mockExecuteWithMnemonic,
    }),
    BACKUP_ACCESS_DOMAIN: 'backup-flow',
}))

import { useMnemonicForAddress } from '../useMnemonicForAddress'

describe('useMnemonicForAddress', () => {
    beforeEach(() => {
        mockExecuteWithMnemonic.mockReset()
        mockExecuteWithMnemonic.mockResolvedValue('result')
    })

    test('forwards keyPairId to KMS for an HD account', async () => {
        const account: WalletAccount = {
            id: 'hd-account-match',
            type: AccountTypes.hdWallet,
            address: 'HD_ADDR',
            keyPairId: 'wallet-1',
            hdWalletDetails: {
                account: 1,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
        }

        const { result } = renderHook(() =>
            useMnemonicForAddress('HD_ADDR', account),
        )

        const handler = vi.fn()
        await result.current.executeWithMnemonic(handler)

        expect(mockExecuteWithMnemonic).toHaveBeenCalledWith(
            'wallet-1',
            'backup-flow',
            handler,
        )
    })

    test('forwards keyPairId to KMS for an algo25 account', async () => {
        const account: WalletAccount = {
            id: 'algo25-account',
            type: AccountTypes.algo25,
            address: 'A25_ADDR',
            keyPairId: 'wallet-2',
        }

        const { result } = renderHook(() =>
            useMnemonicForAddress('A25_ADDR', account),
        )

        const handler = vi.fn()
        await result.current.executeWithMnemonic(handler)

        expect(mockExecuteWithMnemonic).toHaveBeenCalledWith(
            'wallet-2',
            'backup-flow',
            handler,
        )
    })

    test('throws when address is missing', async () => {
        const { result } = renderHook(() =>
            useMnemonicForAddress(undefined, null),
        )

        await expect(
            result.current.executeWithMnemonic(vi.fn()),
        ).rejects.toThrow('Account not found')
    })

    test('throws when account address does not match the requested address', async () => {
        const account: WalletAccount = {
            id: 'hd-account-mismatch',
            type: AccountTypes.hdWallet,
            address: 'OTHER_ADDR',
            keyPairId: 'wallet-1',
            hdWalletDetails: {
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: 9,
            },
        }

        const { result } = renderHook(() =>
            useMnemonicForAddress('HD_ADDR', account),
        )

        await expect(
            result.current.executeWithMnemonic(vi.fn()),
        ).rejects.toThrow('Account not found')
    })

    test('throws for unsupported account types', async () => {
        const account: WalletAccount = {
            id: 'watch-account',
            type: AccountTypes.watch,
            address: 'WATCH_ADDR',
        }

        const { result } = renderHook(() =>
            useMnemonicForAddress('WATCH_ADDR', account),
        )

        await expect(
            result.current.executeWithMnemonic(vi.fn()),
        ).rejects.toThrow('Account type does not support backup')
    })
})
