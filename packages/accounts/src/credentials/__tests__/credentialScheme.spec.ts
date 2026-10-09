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

import { beforeEach, describe, test, expect } from 'vitest'
import type {
    ChainCapabilities,
    ChainDescriptor,
    SigningScheme,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { AccountCustody, WalletAccount } from '../../models'
import {
    credentialScheme,
    usesNonPrimaryScheme,
    type SchemeChain,
} from '../credentialScheme'

type Keys = NonNullable<Parameters<typeof credentialScheme>[2]>

const algorand: SchemeChain = {
    id: 'algorand',
    signing: {
        schemes: ['ed25519', 'falcon-1024'],
        derivationPaths: {},
        rawKeySchemes: [],
    },
    protocol: { supportsNativeMultisig: true },
}

const chainWith = (
    schemes: SigningScheme[],
    supportsNativeMultisig = true,
): SchemeChain => ({
    ...algorand,
    signing: { schemes, derivationPaths: {}, rawKeySchemes: [] },
    protocol: { supportsNativeMultisig },
})

const account = (custody: AccountCustody, keyPairId?: string): WalletAccount =>
    ({
        id: 'a',
        address: 'ADDR',
        custody,
        chains: { algorand: { address: 'ADDR', keyPairId } },
    }) as WalletAccount

const seedWithChild = (
    scheme: 'algo25' | 'quantum' | 'bip39',
    childType: string,
): Keys =>
    [
        { id: 'seed', type: 'seed', metadata: { scheme } },
        { id: 'child', type: childType, metadata: { parentKeyId: 'seed' } },
    ] as unknown as Keys

const algo25 = (keyPairId?: string) =>
    account({ kind: 'local', seed: null }, keyPairId)
const quantum = (keyPairId?: string) =>
    account({ kind: 'local', seed: 'quantum' }, keyPairId)

describe('credentialScheme', () => {
    test("resolves the chain's primary scheme for a key under an algo25 seed", () => {
        expect(
            credentialScheme(
                algo25('child'),
                algorand,
                seedWithChild('algo25', 'ed25519'),
            ),
        ).toBe('ed25519')
    })

    test('resolves falcon-1024 for a key under a quantum seed', () => {
        expect(
            credentialScheme(
                quantum('child'),
                algorand,
                seedWithChild('quantum', 'falcon-1024'),
            ),
        ).toBe('falcon-1024')
    })

    test("follows the seed's scheme when the child entry carries a legacy type", () => {
        expect(
            credentialScheme(
                quantum('child'),
                algorand,
                seedWithChild('quantum', 'falcon1024'),
            ),
        ).toBe('falcon-1024')
    })

    test('follows the seed over the custody when they disagree', () => {
        expect(
            credentialScheme(
                quantum('child'),
                algorand,
                seedWithChild('algo25', 'ed25519'),
            ),
        ).toBe('ed25519')
    })

    test.each([
        ['quantum', quantum, 'falcon-1024'],
        ['algo25', algo25, 'ed25519'],
    ] as const)(
        'falls back to the %s seed while the keystore is not loaded',
        (_seed, build, expected) => {
            expect(credentialScheme(build('missing'), algorand, [])).toBe(
                expected,
            )
        },
    )

    test('has no scheme on a chain the account holds no key for', () => {
        expect(credentialScheme(algo25(), algorand, [])).toBeNull()
    })

    test('has no scheme when the chain does not support the seed scheme', () => {
        expect(
            credentialScheme(quantum('missing'), chainWith(['ed25519']), []),
        ).toBeNull()
    })

    test("signs hardware accounts with the chain's primary scheme", () => {
        const hardware = account({
            kind: 'hardware',
            device: {
                manufacturer: 'ledger',
                deviceId: 'd',
                deviceName: 'n',
                transportType: 'ble',
            },
            accountIndex: 0,
        })

        expect(credentialScheme(hardware, algorand, [])).toBe('ed25519')
        expect(credentialScheme(hardware, chainWith(['falcon-1024']), [])).toBe(
            'falcon-1024',
        )
    })

    test('signs multisig accounts only on chains with native multisig', () => {
        const multisig = account({ kind: 'multisig' })

        expect(credentialScheme(multisig, algorand, [])).toBe('ed25519')
        expect(
            credentialScheme(multisig, chainWith(['ed25519'], false), []),
        ).toBeNull()
    })

    test('has no scheme for a watch account', () => {
        expect(
            credentialScheme(account({ kind: 'watch' }), algorand, []),
        ).toBeNull()
    })
})

describe('usesNonPrimaryScheme', () => {
    beforeEach(() => {
        getProvider().chains.register(
            algorand as unknown as ChainDescriptor,
            {} as ChainCapabilities,
        )
    })

    test("is true for a key that signs with a scheme after the chain's primary", () => {
        expect(
            usesNonPrimaryScheme(
                quantum('child'),
                'algorand',
                seedWithChild('quantum', 'falcon-1024'),
            ),
        ).toBe(true)
    })

    test("is false for a key that signs with the chain's primary scheme", () => {
        expect(
            usesNonPrimaryScheme(
                algo25('child'),
                'algorand',
                seedWithChild('algo25', 'ed25519'),
            ),
        ).toBe(false)
    })

    test('follows the loaded seed over the custody', () => {
        expect(
            usesNonPrimaryScheme(
                quantum('child'),
                'algorand',
                seedWithChild('algo25', 'ed25519'),
            ),
        ).toBe(false)
    })

    test('is false for an account that cannot sign on the chain', () => {
        expect(
            usesNonPrimaryScheme(account({ kind: 'watch' }), 'algorand', []),
        ).toBe(false)
        expect(usesNonPrimaryScheme(quantum(), 'algorand', [])).toBe(false)
    })

    describe('a standalone key on another chain', () => {
        const ethereum: SchemeChain = {
            id: 'ethereum',
            signing: {
                schemes: ['secp256k1'],
                derivationPaths: {},
                rawKeySchemes: ['secp256k1'],
            },
            protocol: { supportsNativeMultisig: false },
        }
        const imported = {
            id: 'e',
            address: '0xabc',
            custody: { kind: 'local', seed: null },
            chains: { ethereum: { address: '0xabc', keyPairId: 'raw-key' } },
        } as WalletAccount

        test("signs with the chain's primary scheme on its own chain", () => {
            expect(credentialScheme(imported, ethereum, [])).toBe('secp256k1')
        })

        test('has no scheme on Algorand, where it holds no key', () => {
            expect(credentialScheme(imported, algorand, [])).toBeNull()
        })
    })
})
