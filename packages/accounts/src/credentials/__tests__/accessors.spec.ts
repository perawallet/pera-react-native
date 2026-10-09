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
import { getProvider } from '@perawallet/wallet-extension-provider'
import { Decimal } from 'decimal.js'
import type {
    AccountChainState,
    ChainDescriptor,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useAccountChainStateStore } from '../../store/accountChainState'
import type { AccountType, WalletAccount } from '../../models'
import { buildTestAccount } from '../../__tests__/accountFactory'
import {
    addressOn,
    authorityOf,
    chainAccountOf,
    custodyOf,
    hardwareDeviceOf,
    hasCustody,
    hdIndexOf,
    isKeyReferenced,
    seedOf,
    signingKeyOn,
    standaloneSecretOf,
} from '../accessors'

type Keys = NonNullable<Parameters<typeof seedOf>[1]>

const mainnet: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const testnet: ChainScope = { chainId: 'algorand', networkId: 'testnet' }

const withoutChains = (type: AccountType): WalletAccount => {
    const { chains: _chains, ...rest } = buildTestAccount(type)
    return rest as WalletAccount
}

const TYPES = [
    'standalone',
    'quantum',
    'hdWallet',
    'hardware',
    'multisig',
    'watch',
] as const

describe('accessors on every stored shape', () => {
    test.each(TYPES)(
        'a %s account answers the same with or without chains',
        type => {
            const built = buildTestAccount(type)
            for (const account of [built, withoutChains(type)]) {
                expect(addressOn(account, mainnet)).toBe(built.address)
                expect(signingKeyOn(account, 'algorand')).toBe(built.keyPairId)
                expect(chainAccountOf(account, 'algorand')?.address).toBe(
                    built.address,
                )
            }
        },
    )

    test.each(TYPES)('a %s account reports its custody', type => {
        const account = buildTestAccount(type)

        expect(custodyOf(account).kind).toBe(
            type === 'hdWallet' || type === 'standalone' || type === 'quantum'
                ? 'local'
                : type,
        )
        expect(hasCustody(account, 'watch')).toBe(type === 'watch')
    })

    test('hdIndexOf gives the seed position from custody', () => {
        expect(hdIndexOf(buildTestAccount('hdWallet'))).toEqual({
            account: 0,
            keyIndex: 0,
        })
        expect(hdIndexOf(buildTestAccount('standalone'))).toBeUndefined()
        expect(hdIndexOf(buildTestAccount('watch'))).toBeUndefined()
    })

    test('hardwareDeviceOf splits the device from the account index', () => {
        expect(hardwareDeviceOf(buildTestAccount('hardware'))).toEqual({
            device: {
                manufacturer: 'ledger',
                deviceId: 'device-1',
                deviceName: 'Nano X',
                transportType: 'ble',
            },
            accountIndex: 0,
        })
        expect(hardwareDeviceOf(buildTestAccount('watch'))).toBeUndefined()
    })

    test('a chain the account is not on has no entry, address or key', () => {
        const account = buildTestAccount('standalone')
        const elsewhere = {
            chainId: 'other',
            networkId: 'x',
        } as unknown as ChainScope

        expect(chainAccountOf(account, 'other' as never)).toBeUndefined()
        expect(addressOn(account, elsewhere)).toBeUndefined()
        expect(signingKeyOn(account, 'other' as never)).toBeUndefined()
    })
})

describe('authorityOf', () => {
    beforeEach(() => {
        useAccountChainStateStore.getState().resetState()
    })

    const chainState = (authAddress?: string): AccountChainState => ({
        family: 'algorand',
        minBalance: new Decimal(100000),
        status: 'Offline',
        totalAssetsOptedIn: 0,
        totalCreatedAssets: 0,
        totalAppsOptedIn: 0,
        ...(authAddress ? { authAddress } : {}),
    })

    const slice = useAccountChainStateStore.getState

    test('reads the slice entry of the requested scope', () => {
        const account = buildTestAccount('watch')
        const address = addressOn(account, testnet) as string
        slice().setAccountChainState(testnet, address, chainState('AUTH'))
        slice().setAccountChainState(mainnet, address, chainState())

        expect(authorityOf(account, testnet)).toBe('AUTH')
        expect(authorityOf(account, mainnet)).toBeNull()
    })

    test("is null for a scope the slice doesn't hold", () => {
        const account = buildTestAccount('watch')
        const address = addressOn(account, mainnet) as string
        slice().setAccountChainState(mainnet, address, chainState('AUTH'))

        expect(authorityOf(account, testnet)).toBeNull()
    })

    test('is null for an account that signs for itself, and on any other chain', () => {
        const account = buildTestAccount('watch')
        const address = addressOn(account, mainnet) as string
        slice().setAccountChainState(mainnet, address, chainState('AUTH'))

        expect(authorityOf(buildTestAccount('standalone'), mainnet)).toBeNull()
        expect(
            authorityOf(account, { chainId: 'ethereum', networkId: 'mainnet' }),
        ).toBeNull()
    })

    test("another address's entry does not answer for this account", () => {
        slice().setAccountChainState(mainnet, 'OTHER', chainState('AUTH'))

        expect(authorityOf(buildTestAccount('watch'), mainnet)).toBeNull()
    })
})

describe('seedOf', () => {
    const keys = [
        { id: 'seed', type: 'seed', metadata: { scheme: 'algo25' } },
        { id: 'child', type: 'ed25519', metadata: { parentKeyId: 'seed' } },
    ] as unknown as Keys

    const local = (keyPairId: string): WalletAccount => ({
        ...buildTestAccount('standalone'),
        keyPairId,
        chains: { algorand: { address: 'ADDR', keyPairId } },
    })

    test('walks a child key to its seed', () => {
        expect(seedOf(local('child'), keys)).toBe('seed')
    })

    test('accepts a key id that is itself a seed', () => {
        expect(seedOf(local('seed'), keys)).toBe('seed')
    })

    test('reads the legacy key of a record without chains', () => {
        const { chains: _chains, ...rest } = local('child')

        expect(seedOf(rest as WalletAccount, keys)).toBe('seed')
    })

    test('is undefined for a key the snapshot lacks', () => {
        expect(seedOf(local('missing'), keys)).toBeUndefined()
    })

    test.each(['hardware', 'multisig', 'watch'] as const)(
        'is undefined for a %s account',
        type => {
            expect(seedOf(buildTestAccount(type), keys)).toBeUndefined()
        },
    )
})

describe('an account on a chain other than the legacy one', () => {
    const onEthereum = {
        id: 'e',
        address: '0xabc',
        keyPairId: 'raw-key',
        custody: { kind: 'local', seed: null },
        chains: { ethereum: { address: '0xabc', keyPairId: 'raw-key' } },
    } as unknown as WalletAccount

    test('is not answered for the legacy chain from its top-level fields', () => {
        expect(chainAccountOf(onEthereum, 'algorand')).toBeUndefined()
        expect(signingKeyOn(onEthereum, 'algorand')).toBeUndefined()
        expect(chainAccountOf(onEthereum, 'ethereum' as never)?.address).toBe(
            '0xabc',
        )
    })

    test('a record without chains still answers for the legacy chain', () => {
        const { chains: _chains, ...legacy } = onEthereum

        expect(chainAccountOf(legacy as WalletAccount, 'algorand')).toEqual({
            address: '0xabc',
            keyPairId: 'raw-key',
        })
    })
})

describe('standaloneSecretOf', () => {
    const register = (
        id: string,
        standaloneSecret?: 'mnemonic' | 'privateKey',
    ) =>
        getProvider().chains.register({
            id,
            signing: {
                schemes: ['ed25519'],
                derivationPaths: {},
                rawKeySchemes: [],
                ...(standaloneSecret ? { standaloneSecret } : {}),
            },
        } as unknown as ChainDescriptor)

    const standaloneOn = (chainId: string): WalletAccount =>
        ({
            id: 'a',
            address: 'ADDR',
            custody: { kind: 'local', seed: null },
            chains: { [chainId]: { address: 'ADDR', keyPairId: 'k' } },
        }) as unknown as WalletAccount

    beforeEach(() => {
        getProvider().chains.reset()
        register('algorand', 'mnemonic')
        register('ethereum', 'privateKey')
    })

    test('reads the secret format from the chain the account lives on', () => {
        expect(standaloneSecretOf(standaloneOn('algorand'))).toBe('mnemonic')
        expect(standaloneSecretOf(standaloneOn('ethereum'))).toBe('privateKey')
    })

    test('reads the legacy chain for a record without chains', () => {
        const { chains: _chains, ...legacy } = standaloneOn('algorand')

        expect(standaloneSecretOf(legacy as WalletAccount)).toBe('mnemonic')
    })

    test('is undefined for HD, quantum and watch accounts', () => {
        for (const type of ['hdWallet', 'quantum', 'watch'] as const) {
            expect(standaloneSecretOf(buildTestAccount(type))).toBeUndefined()
        }
    })

    test('is undefined on a chain that is not registered', () => {
        expect(standaloneSecretOf(standaloneOn('unknown'))).toBeUndefined()
    })
})

describe('isKeyReferenced', () => {
    test('finds a key by the top-level field or a chain entry', () => {
        const accounts = [
            buildTestAccount('standalone'),
            {
                id: 'e',
                address: '0xabc',
                custody: { kind: 'local', seed: null },
                chains: { ethereum: { address: '0xabc', keyPairId: 'raw' } },
            } as unknown as WalletAccount,
        ]

        expect(isKeyReferenced(accounts, 'standalone-key')).toBe(true)
        expect(isKeyReferenced(accounts, 'raw')).toBe(true)
        expect(isKeyReferenced(accounts, 'other')).toBe(false)
    })
})
