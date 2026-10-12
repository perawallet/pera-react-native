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

import { describe, test, expect, beforeEach } from 'vitest'
import { sha256 } from '@noble/hashes/sha2.js'
import { canonify } from 'canonify'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    useAccountChainStateStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { seedAuthority } from '../../../accounts/__tests__/seedAuthority'
import type {
    AuthData,
    AuthDataMetadata,
} from '@perawallet/wallet-core-signing'
import { arc60AuthPayloadFor } from '../arc60AuthPayload'
import { ARC60_SCOPE_AUTH } from '../arc60'
import {
    Arc60BadJsonError,
    Arc60DomainMismatchError,
    Arc60FailedHdPathError,
    Arc60InvalidScopeError,
    Arc60InvalidSignerError,
} from '../arc60-errors'

const MATCHING_HD_PATH = "m/44'/283'/0'/0/1"

const hdAccount = {
    address: 'HD_ADDR',
    keyPairId: 'key-hd-child',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 1 } },
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 1,
        derivationType: 9,
    },
} as unknown as WalletAccount

const algo25Account = {
    address: 'ALGO25_ADDR',
    keyPairId: 'key-algo25-ed25519',
    custody: { kind: 'local', seed: null },
} as unknown as WalletAccount

const hardwareAccount = {
    address: 'HW_ADDR',
    custody: {
        kind: 'hardware',
        device: {
            manufacturer: 'ledger',
            deviceId: 'd',
            deviceName: 'L',
            transportType: 'ble',
        },
        accountIndex: 0,
    },
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'd',
        deviceName: 'L',
        accountIndex: 0,
        transportType: 'ble',
    },
} as unknown as WalletAccount

const quantumAccount = {
    address: 'QUANTUM_ADDR',
    keyPairId: 'key-quantum-falcon',
    custody: { kind: 'local', seed: 'quantum' },
} as unknown as WalletAccount

const domain = 'arc60.io'
const rpIdHash = sha256(new TextEncoder().encode(domain))
const validAuthenticatorData = new Uint8Array([...rpIdHash, 0x05])

const buildSiwa = (overrides: Record<string, unknown> = {}): string =>
    canonify({
        domain,
        account_address: 'HD_ADDR',
        uri: 'https://arc60.io/login',
        version: '1',
        nonce: 'abc123',
        chain_id: 'algorand:mainnet',
        type: 'ed25519',
        ...overrides,
    })!

const samplePayload = new TextEncoder().encode(buildSiwa())
const validAuthData: AuthData = {
    data: encodeToBase64(samplePayload),
    signer: 'HD_ADDR',
    domain,
    authenticatorData: validAuthenticatorData,
}
const validMetadata: AuthDataMetadata = {
    scope: ARC60_SCOPE_AUTH,
    encoding: 'base64',
}

const dataFor = (accountAddress: string) =>
    encodeToBase64(
        new TextEncoder().encode(
            buildSiwa({ account_address: accountAddress }),
        ),
    )

const sign = (
    account: WalletAccount,
    authData: AuthData,
    metadata: AuthDataMetadata = validMetadata,
    accounts: WalletAccount[] = [],
) => arc60AuthPayloadFor(account, authData, metadata, accounts)

describe('arc60AuthPayloadFor', () => {
    beforeEach(() => {
        useAccountChainStateStore.getState().resetState()
    })

    test('rejects unsupported scope', () => {
        expect(() =>
            sign(hdAccount, validAuthData, { scope: 99, encoding: 'base64' }),
        ).toThrow(Arc60InvalidScopeError)
    })

    test('rejects hardware wallet accounts', () => {
        expect(() => sign(hardwareAccount, validAuthData)).toThrow(
            Arc60InvalidSignerError,
        )
    })

    test('rejects when authenticatorData rpIdHash mismatches', () => {
        const tampered = new Uint8Array(validAuthenticatorData)
        tampered[0] ^= 0xff
        expect(() =>
            sign(hdAccount, { ...validAuthData, authenticatorData: tampered }),
        ).toThrow(Arc60DomainMismatchError)
    })

    test('signs an HD account with the sha256(data)||sha256(authenticatorData) payload', () => {
        const payload = sign(hdAccount, validAuthData)

        expect(payload.slice(0, 32)).toEqual(sha256(samplePayload))
        expect(payload.slice(32)).toEqual(sha256(validAuthenticatorData))
        expect(payload.length).toBe(64)
    })

    test('rejects when hdPath does not match the signer derivation', () => {
        expect(() =>
            sign(hdAccount, { ...validAuthData, hdPath: "m/44'/283'/0'/0/99" }),
        ).toThrow(Arc60FailedHdPathError)
    })

    test('accepts a matching hdPath', () => {
        expect(
            sign(hdAccount, { ...validAuthData, hdPath: MATCHING_HD_PATH }),
        ).toBeInstanceOf(Uint8Array)
    })

    test('rejects hdPath on Algo25 accounts', () => {
        expect(() =>
            sign(algo25Account, {
                ...validAuthData,
                data: dataFor('ALGO25_ADDR'),
                signer: 'ALGO25_ADDR',
                hdPath: "m/44'/283'/0'/0/0",
            }),
        ).toThrow(Arc60FailedHdPathError)
    })

    test('signs an Algo25 account with no MX prefix', () => {
        const algo25Siwa = new TextEncoder().encode(
            buildSiwa({ account_address: 'ALGO25_ADDR' }),
        )

        const payload = sign(algo25Account, {
            ...validAuthData,
            data: encodeToBase64(algo25Siwa),
            signer: 'ALGO25_ADDR',
        })

        expect(payload[0]).not.toBe('M'.charCodeAt(0))
        expect(payload[1]).not.toBe('X'.charCodeAt(0))
        expect(payload.slice(0, 32)).toEqual(sha256(algo25Siwa))
    })

    test('rejects when the message domain does not match the request domain', () => {
        const mismatched = new TextEncoder().encode(
            buildSiwa({ domain: 'evil.io' }),
        )
        expect(() =>
            sign(hdAccount, {
                ...validAuthData,
                data: encodeToBase64(mismatched),
            }),
        ).toThrow(Arc60BadJsonError)
    })

    test('rejects when the message account_address does not match the request signer', () => {
        expect(() =>
            sign(hdAccount, { ...validAuthData, data: dataFor('OTHER_ADDR') }),
        ).toThrow(Arc60InvalidSignerError)
    })

    test('rejects when payload is not canonical SIWA JSON', () => {
        const nonSiwa = new TextEncoder().encode('{"not":"siwa"}')
        expect(() =>
            sign(hdAccount, {
                ...validAuthData,
                data: encodeToBase64(nonSiwa),
            }),
        ).toThrow(Arc60BadJsonError)
    })

    test('rejects a rekeyed algo25 naming itself as signer even though it holds its key', () => {
        // Once ORIG_ADDR is rekeyed, control belongs to AUTH_ADDR on chain;
        // a proof made with ORIG_ADDR's old key must not authenticate it.
        const original = {
            ...algo25Account,
            address: 'ORIG_ADDR',
        } as unknown as WalletAccount
        seedAuthority('ORIG_ADDR', 'AUTH_ADDR')

        expect(() =>
            sign(
                original,
                {
                    ...validAuthData,
                    data: dataFor('ORIG_ADDR'),
                    signer: 'ORIG_ADDR',
                },
                validMetadata,
                [original],
            ),
        ).toThrow(Arc60InvalidSignerError)
    })

    test('rejects a watch-rekeyed account even when the auth has keys', () => {
        const watchSource = {
            address: 'WATCH_ADDR',
            custody: { kind: 'watch' },
        } as unknown as WalletAccount
        seedAuthority('WATCH_ADDR', 'AUTH_ADDR')

        expect(() =>
            sign(watchSource, {
                ...validAuthData,
                data: dataFor('WATCH_ADDR'),
                signer: 'WATCH_ADDR',
            }),
        ).toThrow(Arc60InvalidSignerError)
    })

    test('signs for a quantum account, on the same arm as Algo25', () => {
        const payload = sign(quantumAccount, {
            ...validAuthData,
            data: dataFor('QUANTUM_ADDR'),
            signer: 'QUANTUM_ADDR',
        })

        expect(payload).toHaveLength(64)
    })

    test('rejects an hdPath for a quantum account, as it does for algo25', () => {
        expect(() =>
            sign(quantumAccount, {
                ...validAuthData,
                data: dataFor('QUANTUM_ADDR'),
                signer: 'QUANTUM_ADDR',
                hdPath: "m/44'/283'/0'/0/0",
            }),
        ).toThrow(Arc60FailedHdPathError)
    })

    test('rejects a Ledger account (raw-byte signing unsupported on device)', () => {
        const ledger = {
            ...hardwareAccount,
            address: 'LED_ADDR',
        } as unknown as WalletAccount

        expect(() =>
            sign(ledger, {
                ...validAuthData,
                data: dataFor('LED_ADDR'),
                signer: 'LED_ADDR',
            }),
        ).toThrow(Arc60InvalidSignerError)
    })

    test('rejects a rekey revoked since the list was last read', () => {
        const rekeyed = {
            ...algo25Account,
            address: 'ORIG_ADDR',
        } as unknown as WalletAccount
        const authAccount = {
            ...algo25Account,
            address: 'AUTH_ADDR',
        } as unknown as WalletAccount
        seedAuthority('ORIG_ADDR', 'AUTH_ADDR')

        // The message names ORIG_ADDR but the dApp asks AUTH_ADDR to sign, so
        // the rekey cross-check must confirm AUTH_ADDR is ORIG_ADDR's authority.
        const sigData: AuthData = {
            ...validAuthData,
            data: dataFor('ORIG_ADDR'),
            signer: 'AUTH_ADDR',
        }

        expect(
            sign(authAccount, sigData, validMetadata, [rekeyed]),
        ).toBeInstanceOf(Uint8Array)

        seedAuthority('ORIG_ADDR', null)
        expect(() =>
            sign(authAccount, sigData, validMetadata, [rekeyed]),
        ).toThrow(Arc60InvalidSignerError)
    })
})
