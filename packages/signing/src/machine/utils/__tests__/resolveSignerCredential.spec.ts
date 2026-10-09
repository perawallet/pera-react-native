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

import { describe, it, expect } from 'vitest'
import '../../../__tests__/registerAlgorandAccounts'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { ChainAdapterNotRegisteredError } from '@perawallet/wallet-core-chain-contract'
import { CannotSignError } from '../../../pipeline/errors'
import { resolveSignerCredential } from '../resolveSignerCredential'

const ADDRESS = 'ADDR'

const withKey = (custody: unknown): WalletAccount =>
    ({
        address: ADDRESS,
        custody,
        chains: { algorand: { address: ADDRESS, keyPairId: 'key-1' } },
    }) as unknown as WalletAccount

const withoutKey = (custody: unknown): WalletAccount =>
    ({
        address: ADDRESS,
        custody,
        chains: { algorand: { address: ADDRESS } },
    }) as unknown as WalletAccount

const LEDGER = {
    kind: 'hardware',
    device: {
        manufacturer: 'ledger',
        deviceId: 'dev-1',
        deviceName: 'Nano X',
        transportType: 'ble',
    },
    accountIndex: 0,
}

describe('resolveSignerCredential', () => {
    it.each([
        [
            'algo25',
            withKey({ kind: 'local', seed: null }),
            { custody: 'local', scheme: 'ed25519' },
        ],
        [
            'HD wallet',
            withKey({
                kind: 'local',
                seed: 'bip39',
                hd: { account: 0, keyIndex: 0 },
            }),
            { custody: 'local', scheme: 'ed25519' },
        ],
        [
            'quantum',
            withKey({ kind: 'local', seed: 'quantum' }),
            { custody: 'local', scheme: 'falcon-1024' },
        ],
        [
            'Ledger',
            withoutKey(LEDGER),
            { custody: 'hardware', scheme: 'ed25519' },
        ],
        [
            'multisig',
            withoutKey({ kind: 'multisig' }),
            { custody: 'multisig', scheme: 'ed25519' },
        ],
    ])('resolves a %s account on Algorand', (_kind, account, expected) => {
        expect(resolveSignerCredential(account, 'algorand')).toEqual(expected)
    })

    it('refuses a watch account', () => {
        expect(() =>
            resolveSignerCredential(withoutKey({ kind: 'watch' }), 'algorand'),
        ).toThrow(CannotSignError)
    })

    it('refuses a local account that holds no key on the chain', () => {
        expect(() =>
            resolveSignerCredential(
                withoutKey({ kind: 'local', seed: null }),
                'algorand',
            ),
        ).toThrow(CannotSignError)
    })

    it('never resolves a signer on a chain that is not registered', () => {
        expect(() =>
            resolveSignerCredential(
                withKey({ kind: 'local', seed: null }),
                'ethereum',
            ),
        ).toThrow(ChainAdapterNotRegisteredError)
    })
})
