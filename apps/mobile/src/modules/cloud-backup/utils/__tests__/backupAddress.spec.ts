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

import { describe, it, expect, vi } from 'vitest'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { backupAccountsOf, backupAddressOf } from '../backupAddress'

// The chains this build backs up; the package orders them by chain id.
vi.mock('@perawallet/wallet-core-backup', () => ({
    accountBackupAddresses: (account: WalletAccount) =>
        Object.entries(account.chains)
            .filter(([chain]) => chain === 'algorand' || chain === 'ethereum')
            .sort(([a], [b]) => a.localeCompare(b))
            .flatMap(([, entry]) => (entry ? [entry.address] : [])),
}))

const account = (
    id: string,
    chains: WalletAccount['chains'],
): WalletAccount => ({
    id,
    custody: { kind: 'watch' },
    chains,
})

const algorand = account('algo', { algorand: { address: 'ALGO_ADDR' } })
const ethereumOnly = account('eth', { ethereum: { address: '0xabc' } })
const bothChains = account('both', {
    ethereum: { address: '0xboth' },
    algorand: { address: 'ALGO_BOTH' },
})
const unbacked = account('none', {
    other: { address: 'NOPE' },
} as unknown as WalletAccount['chains'])

describe('backupAddressOf', () => {
    it('names the account by its first address on a backed-up chain', () => {
        expect(backupAddressOf(bothChains)).toBe('ALGO_BOTH')
    })

    it('names an account on Ethereum alone by its Ethereum address', () => {
        expect(backupAddressOf(ethereumOnly)).toBe('0xabc')
    })

    it('has no name for an account on no backed-up chain', () => {
        expect(backupAddressOf(unbacked)).toBeUndefined()
    })
})

describe('backupAccountsOf', () => {
    it('pairs each account that has a backup record with its name, in order', () => {
        expect(backupAccountsOf([algorand, unbacked, ethereumOnly])).toEqual([
            { account: algorand, address: 'ALGO_ADDR' },
            { account: ethereumOnly, address: '0xabc' },
        ])
    })

    it('is empty when no account has a backup record', () => {
        expect(backupAccountsOf([unbacked])).toEqual([])
    })
})
