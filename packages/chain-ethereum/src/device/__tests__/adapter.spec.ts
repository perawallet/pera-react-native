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

import { describe, expect, it } from 'vitest'
import type {
    AccountCustody,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { BASE, ETHEREUM } from '../../__tests__/evm-chains'
import { createEvmDeviceAdapter } from '../adapter'

const accountWith = (custody: AccountCustody): WalletAccount => ({
    id: 'acct',
    custody,
    chains: { ethereum: { address: '0xabc' } },
})

const HARDWARE: AccountCustody = {
    kind: 'hardware',
    device: {
        manufacturer: 'ledger',
        deviceId: 'ledger-1',
        deviceName: 'Nano',
        transportType: 'ble',
    },
    accountIndex: 0,
}

describe('createEvmDeviceAdapter', () => {
    it('registers for the chain it was built for', () => {
        expect(createEvmDeviceAdapter(ETHEREUM).chainId).toBe('ethereum')
        expect(createEvmDeviceAdapter(BASE).chainId).toBe('base')
    })

    it.each([
        [
            'an HD account',
            { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
            'hdWallet',
        ],
        ['a hardware account', HARDWARE, 'hardware'],
        ['a watch account', { kind: 'watch' }, 'watch'],
    ] as [string, AccountCustody, string][])(
        'registers %s under its EVM account type',
        (_label, custody, expected) => {
            expect(
                createEvmDeviceAdapter(ETHEREUM).accountTypeOf(
                    accountWith(custody),
                ),
            ).toBe(expected)
        },
    )

    it('does not register a raw private-key account, which the devices API has no EVM account type for', () => {
        expect(
            createEvmDeviceAdapter(ETHEREUM).accountTypeOf(
                accountWith({ kind: 'local', seed: null }),
            ),
        ).toBeNull()
    })

    it.each([
        ['a multisig account', { kind: 'multisig' }],
        ['a post-quantum account', { kind: 'local', seed: 'quantum' }],
        ['an Algo25-seeded account', { kind: 'local', seed: 'algo25' }],
    ] as [string, AccountCustody][])(
        'does not register %s, which has no EVM account type',
        (_label, custody) => {
            expect(
                createEvmDeviceAdapter(ETHEREUM).accountTypeOf(
                    accountWith(custody),
                ),
            ).toBeNull()
        },
    )

    it('ranks every kind equally', () => {
        const adapter = createEvmDeviceAdapter(ETHEREUM)

        expect(adapter.rankOf(accountWith({ kind: 'watch' }))).toBe(
            adapter.rankOf(accountWith(HARDWARE)),
        )
    })

    it('stays off the v3 devices API, which names no chain', () => {
        expect(createEvmDeviceAdapter(ETHEREUM).isOnV3DevicesApi).toBeFalsy()
    })
})
