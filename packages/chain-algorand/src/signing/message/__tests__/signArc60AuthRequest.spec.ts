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

import { describe, test, expect, vi, beforeEach } from 'vitest'
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
import { signArc60AuthRequest } from '../signArc60AuthRequest'
import { ARC60_SCOPE_AUTH } from '../arc60'
import {
    Arc60BadJsonError,
    Arc60DomainMismatchError,
    Arc60FailedHdPathError,
    Arc60InvalidScopeError,
    Arc60InvalidSignerError,
} from '../arc60-errors'
import { ALGORAND_CHAIN_ID } from '../../../chain-id'

const signPayloads = vi.fn()
const deps = { signPayloads }

const MATCHING_HD_PATH = "m/44'/283'/0'/0/1"

const hdAccount = {
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 1 } },
    chains: {
        [ALGORAND_CHAIN_ID]: {
            address: 'HD_ADDR',
            keyPairId: 'key-hd-child',
        },
    },
} as unknown as WalletAccount

const standaloneAccount = {
    custody: { kind: 'local', seed: null },
    chains: {
        [ALGORAND_CHAIN_ID]: {
            address: 'ALGO25_ADDR',
            keyPairId: 'key-algo25-ed25519',
        },
    },
} as unknown as WalletAccount

const hardwareAccount = {
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
    chains: {
        [ALGORAND_CHAIN_ID]: {
            address: 'HW_ADDR',
        },
    },
} as unknown as WalletAccount

const quantumAccount = {
    custody: { kind: 'local', seed: 'quantum' },
    chains: {
        [ALGORAND_CHAIN_ID]: {
            address: 'QUANTUM_ADDR',
            keyPairId: 'key-quantum-falcon',
        },
    },
} as unknown as WalletAccount

const atAddress = (account: WalletAccount, address: string) => ({
    [ALGORAND_CHAIN_ID]: { ...account.chains[ALGORAND_CHAIN_ID], address },
})

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
) => signArc60AuthRequest(deps, account, authData, metadata, accounts)

describe('signArc60AuthRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useAccountChainStateStore.getState().resetState()
        signPayloads.mockResolvedValue([new Uint8Array([0])])
    })

    test('rejects unsupported scope', async () => {
        await expect(
            sign(hdAccount, validAuthData, { scope: 99, encoding: 'base64' }),
        ).rejects.toBeInstanceOf(Arc60InvalidScopeError)
    })

    test('rejects hardware wallet accounts', async () => {
        await expect(
            sign(hardwareAccount, validAuthData),
        ).rejects.toBeInstanceOf(Arc60InvalidSignerError)
    })

    test('rejects when authenticatorData rpIdHash mismatches', async () => {
        const tampered = new Uint8Array(validAuthenticatorData)
        tampered[0] ^= 0xff
        await expect(
            sign(hdAccount, { ...validAuthData, authenticatorData: tampered }),
        ).rejects.toBeInstanceOf(Arc60DomainMismatchError)
    })

    test('signs an HD account with the sha256(data)||sha256(authenticatorData) payload', async () => {
        const sigBytes = new Uint8Array([1, 2, 3])
        signPayloads.mockResolvedValue([sigBytes])

        const signature = await sign(hdAccount, validAuthData)

        expect(signature).toEqual(sigBytes)
        expect(signPayloads).toHaveBeenCalledTimes(1)
        const [keyPairId, items] = signPayloads.mock.calls[0]
        expect(keyPairId).toBe('key-hd-child')
        const payload = items[0] as Uint8Array
        expect(payload.slice(0, 32)).toEqual(sha256(samplePayload))
        expect(payload.slice(32)).toEqual(sha256(validAuthenticatorData))
        expect(payload.length).toBe(64)
    })

    test('rejects when hdPath does not match the signer derivation', async () => {
        await expect(
            sign(hdAccount, { ...validAuthData, hdPath: "m/44'/283'/0'/0/99" }),
        ).rejects.toBeInstanceOf(Arc60FailedHdPathError)
    })

    test('accepts a matching hdPath', async () => {
        await expect(
            sign(hdAccount, { ...validAuthData, hdPath: MATCHING_HD_PATH }),
        ).resolves.toBeInstanceOf(Uint8Array)
    })

    test('rejects hdPath on Algo25 accounts', async () => {
        await expect(
            sign(standaloneAccount, {
                ...validAuthData,
                data: dataFor('ALGO25_ADDR'),
                signer: 'ALGO25_ADDR',
                hdPath: "m/44'/283'/0'/0/0",
            }),
        ).rejects.toBeInstanceOf(Arc60FailedHdPathError)
    })

    test('signs an Algo25 account with no MX prefix', async () => {
        const algo25Siwa = new TextEncoder().encode(
            buildSiwa({ account_address: 'ALGO25_ADDR' }),
        )

        await sign(standaloneAccount, {
            ...validAuthData,
            data: encodeToBase64(algo25Siwa),
            signer: 'ALGO25_ADDR',
        })

        const [keyPairId, items] = signPayloads.mock.calls[0]
        expect(keyPairId).toBe('key-algo25-ed25519')
        const payload = items[0] as Uint8Array
        expect(payload[0]).not.toBe('M'.charCodeAt(0))
        expect(payload[1]).not.toBe('X'.charCodeAt(0))
        expect(payload.slice(0, 32)).toEqual(sha256(algo25Siwa))
    })

    test('rejects when the message domain does not match the request domain', async () => {
        const mismatched = new TextEncoder().encode(
            buildSiwa({ domain: 'evil.io' }),
        )
        await expect(
            sign(hdAccount, {
                ...validAuthData,
                data: encodeToBase64(mismatched),
            }),
        ).rejects.toBeInstanceOf(Arc60BadJsonError)
    })

    test('rejects when the message account_address does not match the request signer', async () => {
        await expect(
            sign(hdAccount, { ...validAuthData, data: dataFor('OTHER_ADDR') }),
        ).rejects.toBeInstanceOf(Arc60InvalidSignerError)
    })

    test('rejects when payload is not canonical SIWA JSON', async () => {
        const nonSiwa = new TextEncoder().encode('{"not":"siwa"}')
        await expect(
            sign(hdAccount, {
                ...validAuthData,
                data: encodeToBase64(nonSiwa),
            }),
        ).rejects.toBeInstanceOf(Arc60BadJsonError)
    })

    test('rejects a rekeyed algo25 naming itself as signer even though it holds its key', async () => {
        // Once ORIG_ADDR is rekeyed, control belongs to AUTH_ADDR on chain;
        // a proof made with ORIG_ADDR's old key must not authenticate it.
        const original = {
            ...standaloneAccount,
            chains: atAddress(standaloneAccount, 'ORIG_ADDR'),
            rekeyAddress: 'AUTH_ADDR',
        } as unknown as WalletAccount
        seedAuthority('ORIG_ADDR', 'AUTH_ADDR')

        await expect(
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
        ).rejects.toBeInstanceOf(Arc60InvalidSignerError)
        expect(signPayloads).not.toHaveBeenCalled()
    })

    test('rejects a watch-rekeyed account even when the auth has keys', async () => {
        const watchSource = {
            custody: { kind: 'watch' },
            chains: {
                [ALGORAND_CHAIN_ID]: {
                    address: 'WATCH_ADDR',
                },
            },
            rekeyAddress: 'AUTH_ADDR',
        } as unknown as WalletAccount
        seedAuthority('WATCH_ADDR', 'AUTH_ADDR')

        await expect(
            sign(watchSource, {
                ...validAuthData,
                data: dataFor('WATCH_ADDR'),
                signer: 'WATCH_ADDR',
            }),
        ).rejects.toBeInstanceOf(Arc60InvalidSignerError)
    })

    test('signs for a quantum account, on the same arm as Algo25', async () => {
        const signature = await sign(quantumAccount, {
            ...validAuthData,
            data: dataFor('QUANTUM_ADDR'),
            signer: 'QUANTUM_ADDR',
        })

        expect(signature).toBeInstanceOf(Uint8Array)
        expect(signPayloads.mock.calls[0][0]).toBe('key-quantum-falcon')
    })

    test('rejects an hdPath for a quantum account, as it does for algo25', async () => {
        await expect(
            sign(quantumAccount, {
                ...validAuthData,
                data: dataFor('QUANTUM_ADDR'),
                signer: 'QUANTUM_ADDR',
                hdPath: "m/44'/283'/0'/0/0",
            }),
        ).rejects.toBeInstanceOf(Arc60FailedHdPathError)
    })

    test('rejects a Ledger account (raw-byte signing unsupported on device)', async () => {
        const ledger = {
            ...hardwareAccount,
            chains: atAddress(hardwareAccount, 'LED_ADDR'),
        } as unknown as WalletAccount

        await expect(
            sign(ledger, {
                ...validAuthData,
                data: dataFor('LED_ADDR'),
                signer: 'LED_ADDR',
            }),
        ).rejects.toBeInstanceOf(Arc60InvalidSignerError)
    })

    test('rejects a rekey revoked since the list was last read', async () => {
        const rekeyed = {
            ...standaloneAccount,
            chains: atAddress(standaloneAccount, 'ORIG_ADDR'),
            rekeyAddress: 'AUTH_ADDR',
        } as unknown as WalletAccount
        seedAuthority('ORIG_ADDR', 'AUTH_ADDR')

        // The message names ORIG_ADDR but the dApp asks AUTH_ADDR to sign, so
        // the rekey cross-check must confirm AUTH_ADDR is ORIG_ADDR's authority.
        const sigData: AuthData = {
            ...validAuthData,
            data: dataFor('ORIG_ADDR'),
            signer: 'AUTH_ADDR',
        }

        await sign(rekeyed, sigData, validMetadata, [rekeyed])
        expect(signPayloads).toHaveBeenCalledTimes(1)

        seedAuthority('ORIG_ADDR', null)
        await expect(
            sign(rekeyed, sigData, validMetadata, [rekeyed]),
        ).rejects.toBeInstanceOf(Arc60InvalidSignerError)
        expect(signPayloads).toHaveBeenCalledTimes(1)
    })
})
