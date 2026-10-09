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
import { renderHook } from '@testing-library/react'
import {
    CHAIN_CAPABILITIES,
    keyDerivations,
    type ChainCapabilities,
    type ChainDescriptor,
} from '@perawallet/wallet-core-chain-contract'
import { BACKUP_ACCESS_DOMAIN } from '@perawallet/wallet-core-kms'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { PrivateKeyRevealUnsupportedError } from '../../errors'
import {
    FAKE_CHAIN_ID,
    registerFakeAccountsChain,
} from '../../__tests__/fakeAccountsChain'
import { testAccount } from '../../__tests__/accountFactory'
import { useAccountsStore } from '../../store'
import { useRevealPrivateKey } from '../useRevealPrivateKey'

const KEY_ID = 'raw-hardhat-0'

const fakeKms = vi.hoisted(() => ({
    entries: new Map<string, Uint8Array>(),
    importRawKey: vi.fn(),
    exportSecp256k1Key: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<typeof import('@perawallet/wallet-core-kms')>()),
    kmsCore: fakeKms,
    useKMS: () => ({ exportSecp256k1Key: fakeKms.exportSecp256k1Key }),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    selectChainNetworkId: () => 'mainnet',
}))

const capabilities = Object.fromEntries(
    CHAIN_CAPABILITIES.map(capability => [capability, true]),
) as ChainCapabilities

const registerChain = (standaloneSecret: 'mnemonic' | 'privateKey') => {
    getProvider().chains.reset()
    getProvider().chains.register(
        {
            id: FAKE_CHAIN_ID,
            signing: {
                schemes: ['secp256k1'],
                derivationPaths: {},
                rawKeySchemes: ['secp256k1'],
                standaloneSecret,
            },
        } as unknown as ChainDescriptor,
        capabilities,
    )
}

const ORIGINAL_KEY = Uint8Array.from({ length: 32 }, (_, i) => i + 1)

const importAccount = () =>
    useAccountsStore
        .getState()
        .importAccountFromPrivateKey(
            FAKE_CHAIN_ID,
            Uint8Array.from(ORIGINAL_KEY),
        )

describe('useRevealPrivateKey', () => {
    const authenticate = vi.fn()

    beforeEach(() => {
        fakeKms.entries.clear()
        fakeKms.importRawKey.mockReset()
        fakeKms.importRawKey.mockImplementation(
            async (bytes: Uint8Array, request: { id: string }) => {
                fakeKms.entries.set(request.id, new Uint8Array(bytes))
                return { keyPairId: request.id, publicKey: new Uint8Array(65) }
            },
        )
        fakeKms.exportSecp256k1Key.mockReset()
        fakeKms.exportSecp256k1Key.mockImplementation(async (id: string) =>
            Uint8Array.from(fakeKms.entries.get(id) ?? []),
        )
        authenticate.mockReset()
        registerFakeAccountsChain({
            revealPrivateKey: (keystore, keyPairId, domain) =>
                keystore.exportSecp256k1Key(keyPairId, domain),
        })
        keyDerivations.reset()
        keyDerivations.register({
            chainId: FAKE_CHAIN_ID,
            deriveAccount: vi.fn(),
            importRawKey: async (kms, bytes) => ({
                ...(await kms.importRawKey(bytes, {
                    scheme: 'secp256k1',
                    id: KEY_ID,
                })),
                address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            }),
            discover: vi.fn(),
        })
        registerChain('privateKey')
        useAccountsStore.getState().resetState()
    })

    test('returns the imported bytes only after authentication resolves', async () => {
        const account = await importAccount()
        const order: string[] = []
        authenticate.mockImplementation(async () => {
            order.push('authenticate')
            return true
        })
        fakeKms.exportSecp256k1Key.mockImplementationOnce(async () => {
            order.push('export')
            return Uint8Array.from(ORIGINAL_KEY)
        })
        const { result } = renderHook(() => useRevealPrivateKey())

        const revealed = await result.current.revealPrivateKey(
            account.id,
            authenticate,
        )

        expect(revealed).toEqual(ORIGINAL_KEY)
        expect(order).toEqual(['authenticate', 'export'])
        expect(fakeKms.exportSecp256k1Key).toHaveBeenCalledWith(
            KEY_ID,
            BACKUP_ACCESS_DOMAIN,
        )
    })

    test('returns null and exports nothing when authentication is declined', async () => {
        const account = await importAccount()
        authenticate.mockResolvedValue(false)
        const { result } = renderHook(() => useRevealPrivateKey())

        const revealed = await result.current.revealPrivateKey(
            account.id,
            authenticate,
        )

        expect(revealed).toBeNull()
        expect(fakeKms.exportSecp256k1Key).not.toHaveBeenCalled()
    })

    test.each(['hd', 'watch', 'explicit'] as const)(
        'refuses a %s account before asking to authenticate',
        async custody => {
            const account = testAccount(custody)
            useAccountsStore.getState().setAccounts([account])
            const { result } = renderHook(() => useRevealPrivateKey())

            await expect(
                result.current.revealPrivateKey(account.id, authenticate),
            ).rejects.toBeInstanceOf(PrivateKeyRevealUnsupportedError)
            expect(authenticate).not.toHaveBeenCalled()
        },
    )

    test('refuses a standalone account whose secret is a mnemonic', async () => {
        const account = await importAccount()
        registerChain('mnemonic')
        const { result } = renderHook(() => useRevealPrivateKey())

        await expect(
            result.current.revealPrivateKey(account.id, authenticate),
        ).rejects.toBeInstanceOf(PrivateKeyRevealUnsupportedError)
        expect(authenticate).not.toHaveBeenCalled()
    })

    test('refuses an account whose chain adapter cannot reveal a private key', async () => {
        const account = await importAccount()
        registerFakeAccountsChain()
        const { result } = renderHook(() => useRevealPrivateKey())

        await expect(
            result.current.revealPrivateKey(account.id, authenticate),
        ).rejects.toBeInstanceOf(PrivateKeyRevealUnsupportedError)
        expect(authenticate).not.toHaveBeenCalled()
    })

    test('refuses an account the wallet does not hold', async () => {
        const { result } = renderHook(() => useRevealPrivateKey())

        await expect(
            result.current.revealPrivateKey('missing', authenticate),
        ).rejects.toBeInstanceOf(PrivateKeyRevealUnsupportedError)
        expect(authenticate).not.toHaveBeenCalled()
    })
})
