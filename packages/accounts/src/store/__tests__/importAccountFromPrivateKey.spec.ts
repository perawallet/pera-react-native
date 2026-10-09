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

import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
    CHAIN_CAPABILITIES,
    keyDerivations,
    type ChainCapabilities,
    type ChainDescriptor,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    DuplicateAccountError,
    RawKeyImportUnsupportedError,
} from '../../errors'
import { FAKE_CHAIN_ID } from '../../__tests__/fakeAccountsChain'
import { buildTestAccount } from '../../__tests__/accountFactory'
import { accountType } from '../../utils'
import { useAccountsStore } from '../store'

const HARDHAT_0_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const KEY_ID = 'raw-hardhat-0'

const fakeKms = vi.hoisted(() => ({
    entries: new Map<string, Uint8Array>(),
    importRawKey: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<typeof import('@perawallet/wallet-core-kms')>()),
    kmsCore: fakeKms,
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    selectChainNetworkId: () => 'mainnet',
}))

const capabilities = (privateKeys: boolean): ChainCapabilities =>
    Object.fromEntries(
        CHAIN_CAPABILITIES.map(capability => [
            capability,
            capability === 'privateKeys' && privateKeys,
        ]),
    ) as ChainCapabilities

const registerChain = (privateKeys: boolean) => {
    getProvider().chains.reset()
    getProvider().chains.register(
        {
            id: FAKE_CHAIN_ID,
            signing: {
                schemes: ['secp256k1'],
                derivationPaths: {},
                rawKeySchemes: ['secp256k1'],
                standaloneSecret: 'privateKey',
            },
        } as unknown as ChainDescriptor,
        capabilities(privateKeys),
    )
}

const privateKey = () => Uint8Array.from({ length: 32 }, (_, i) => i + 1)
const isZero = (bytes: Uint8Array) => bytes.every(b => b === 0)

describe('importAccountFromPrivateKey', () => {
    const sawNonZeroBytes: boolean[] = []
    const importRawKey = vi.fn()

    beforeEach(() => {
        sawNonZeroBytes.length = 0
        fakeKms.entries.clear()
        fakeKms.importRawKey.mockReset()
        fakeKms.importRawKey.mockImplementation(
            async (bytes: Uint8Array, request: { id: string }) => {
                fakeKms.entries.set(request.id, new Uint8Array(bytes))
                return { keyPairId: request.id, publicKey: new Uint8Array(65) }
            },
        )
        importRawKey.mockReset()
        importRawKey.mockImplementation(
            async (kms: typeof fakeKms, bytes: Uint8Array) => {
                sawNonZeroBytes.push(!isZero(bytes))
                const { keyPairId } = await kms.importRawKey(bytes, {
                    scheme: 'secp256k1',
                    id: KEY_ID,
                })
                return { keyPairId, address: HARDHAT_0_ADDRESS }
            },
        )
        keyDerivations.reset()
        keyDerivations.register({
            chainId: FAKE_CHAIN_ID,
            deriveAccount: vi.fn(),
            importRawKey,
            discover: vi.fn(),
        })
        registerChain(true)
        useAccountsStore.getState().resetState()
    })

    test('adds a standalone account holding one chain entry for the imported key', async () => {
        const account = await useAccountsStore
            .getState()
            .importAccountFromPrivateKey(FAKE_CHAIN_ID, privateKey(), 'Hardhat')

        expect(account.custody).toEqual({ kind: 'local', seed: null })
        expect(accountType(account)).toBe('standalone')
        expect(account.name).toBe('Hardhat')
        expect(account.chains).toEqual({
            [FAKE_CHAIN_ID]: { address: HARDHAT_0_ADDRESS, keyPairId: KEY_ID },
        })
        expect(useAccountsStore.getState().accounts).toEqual([account])
    })

    test('refuses a second import of the same key without removing the entry the first account uses', async () => {
        const first = await useAccountsStore
            .getState()
            .importAccountFromPrivateKey(FAKE_CHAIN_ID, privateKey())

        const second = useAccountsStore
            .getState()
            .importAccountFromPrivateKey(FAKE_CHAIN_ID, privateKey())

        await expect(second).rejects.toBeInstanceOf(DuplicateAccountError)
        await expect(second).rejects.toMatchObject({
            metadata: { params: { existingAccountId: first.id } },
        })
        expect(getProvider().key.store.remove).not.toHaveBeenCalled()
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('refuses an address a watch account holds, naming it, and removes the entry it just made', async () => {
        const watch = buildTestAccount('watch')
        useAccountsStore.getState().setAccounts([
            {
                ...watch,
                address: HARDHAT_0_ADDRESS,
                chains: { [FAKE_CHAIN_ID]: { address: HARDHAT_0_ADDRESS } },
            },
        ])

        const result = useAccountsStore
            .getState()
            .importAccountFromPrivateKey(FAKE_CHAIN_ID, privateKey())

        await expect(result).rejects.toMatchObject({
            metadata: { params: { existingAccountId: watch.id } },
        })
        expect(getProvider().key.store.remove).toHaveBeenCalledWith(KEY_ID)
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
    })

    test('throws a keyed error before the KMS when the chain imports no raw keys', async () => {
        registerChain(false)
        const key = privateKey()

        const result = useAccountsStore
            .getState()
            .importAccountFromPrivateKey(FAKE_CHAIN_ID, key)

        await expect(result).rejects.toBeInstanceOf(
            RawKeyImportUnsupportedError,
        )
        await expect(result).rejects.toMatchObject({
            metadata: { messageKey: 'errors.account.generic' },
        })
        expect(importRawKey).not.toHaveBeenCalled()
        expect(fakeKms.importRawKey).not.toHaveBeenCalled()
        expect(isZero(key)).toBe(true)
    })

    test('zeroes the input buffer after a successful import', async () => {
        const key = privateKey()

        await useAccountsStore
            .getState()
            .importAccountFromPrivateKey(FAKE_CHAIN_ID, key)

        expect(sawNonZeroBytes).toEqual([true])
        expect(isZero(key)).toBe(true)
    })

    test('zeroes the input buffer when the import is refused', async () => {
        await useAccountsStore
            .getState()
            .importAccountFromPrivateKey(FAKE_CHAIN_ID, privateKey())
        const key = privateKey()

        await expect(
            useAccountsStore
                .getState()
                .importAccountFromPrivateKey(FAKE_CHAIN_ID, key),
        ).rejects.toBeInstanceOf(DuplicateAccountError)

        expect(sawNonZeroBytes).toEqual([true, true])
        expect(isZero(key)).toBe(true)
    })

    test('zeroes the input buffer when the chain derivation throws', async () => {
        importRawKey.mockRejectedValueOnce(new Error('kms down'))
        const key = privateKey()

        await expect(
            useAccountsStore
                .getState()
                .importAccountFromPrivateKey(FAKE_CHAIN_ID, key),
        ).rejects.toThrow('kms down')

        expect(isZero(key)).toBe(true)
    })
})
