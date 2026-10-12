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
import {
    CHAIN_CAPABILITIES,
    type AccountChainState,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainScope,
    type StandaloneSecret,
} from '@perawallet/wallet-core-chain-contract'
import { useAccountChainStateStore } from '../../store/accountChainState'
import type { WalletAccount } from '../../models'
import {
    buildTestAccount,
    TEST_CUSTODY,
    testAccount,
    type TestCustody,
} from '../../__tests__/accountFactory'
import {
    FAKE_CHAIN_ID,
    MAINNET_SCOPE as mainnet,
    TESTNET_SCOPE as testnet,
} from '../../__tests__/fakeAccountsChain'
import {
    addressOn,
    authorityOf,
    chainAccountOf,
    custodyOf,
    hardwareDetailsOf,
    hardwareDeviceOf,
    hasCustody,
    hasRecoverySeed,
    hdIndexOf,
    isKeyReferenced,
    seedOf,
    signingKeyOn,
    standaloneSecretOf,
} from '../accessors'

type Keys = NonNullable<Parameters<typeof seedOf>[1]>

const CUSTODIES = Object.keys(TEST_CUSTODY) as TestCustody[]

const registerChain = (id: string, standaloneSecret?: StandaloneSecret) =>
    getProvider().chains.register(
        {
            id,
            signing: {
                schemes: ['ed25519'],
                derivationPaths: {},
                rawKeySchemes: [],
                ...(standaloneSecret ? { standaloneSecret } : {}),
            },
        } as unknown as ChainDescriptor,
        Object.fromEntries(
            CHAIN_CAPABILITIES.map(capability => [capability, false]),
        ) as ChainCapabilities,
    )

describe('accessors', () => {
    test.each(CUSTODIES)('a %s account reads its chain entry', custody => {
        const account = testAccount(custody, 'ADDR')
        const entry = account.chains[FAKE_CHAIN_ID]

        expect(addressOn(account, mainnet)).toBe('ADDR')
        expect(chainAccountOf(account, FAKE_CHAIN_ID)).toBe(entry)
        expect(signingKeyOn(account, FAKE_CHAIN_ID)).toBe(entry?.keyPairId)
    })

    test.each(CUSTODIES)('a %s account reports its custody', custody => {
        const account = testAccount(custody)

        expect(custodyOf(account)).toBe(TEST_CUSTODY[custody])
        expect(hasCustody(account, 'watch')).toBe(custody === 'watch')
        expect(hasCustody(account, 'local')).toBe(
            TEST_CUSTODY[custody].kind === 'local',
        )
    })

    test('only local custody has a recovery seed', () => {
        registerChain(FAKE_CHAIN_ID, 'mnemonic')

        expect(
            CUSTODIES.filter(custody => hasRecoverySeed(testAccount(custody))),
        ).toEqual(['local', 'explicit', 'hd'])
    })

    test('a standalone key has no recovery seed where its chain stores the private key', () => {
        registerChain(FAKE_CHAIN_ID, 'privateKey')

        expect(hasRecoverySeed(testAccount('local'))).toBe(false)
        expect(hasRecoverySeed(testAccount('hd'))).toBe(true)
    })

    test('hdIndexOf gives the seed position from custody', () => {
        expect(hdIndexOf(testAccount('hd'))).toEqual({
            account: 0,
            keyIndex: 0,
        })
        expect(hdIndexOf(testAccount('local'))).toBeUndefined()
        expect(hdIndexOf(testAccount('watch'))).toBeUndefined()
    })

    test('hardwareDeviceOf splits the device from the account index', () => {
        expect(hardwareDeviceOf(testAccount('hardware'))).toEqual({
            device: TEST_CUSTODY.hardware.device,
            accountIndex: 0,
        })
        expect(hardwareDeviceOf(testAccount('watch'))).toBeUndefined()
    })

    test('hardwareDetailsOf flattens the device with its account index', () => {
        expect(hardwareDetailsOf(testAccount('hardware'))).toEqual({
            ...TEST_CUSTODY.hardware.device,
            accountIndex: 0,
        })
        expect(hardwareDetailsOf(testAccount('local'))).toBeUndefined()
    })

    test('a chain the account is not on has no entry, address or key', () => {
        const account = testAccount('local')
        const elsewhere: ChainScope = {
            chainId: 'ethereum',
            networkId: 'mainnet',
        }

        expect(chainAccountOf(account, 'ethereum')).toBeUndefined()
        expect(addressOn(account, elsewhere)).toBeUndefined()
        expect(signingKeyOn(account, 'ethereum')).toBeUndefined()
    })

    test('each chain answers from its own entry', () => {
        const account = buildTestAccount(TEST_CUSTODY.local, {
            [FAKE_CHAIN_ID]: { address: 'FAKE', keyPairId: 'k-fake' },
            ethereum: { address: '0xabc', keyPairId: 'k-eth' },
        })

        expect(
            addressOn(account, { chainId: 'ethereum', networkId: 'mainnet' }),
        ).toBe('0xabc')
        expect(signingKeyOn(account, 'ethereum')).toBe('k-eth')
        expect(signingKeyOn(account, FAKE_CHAIN_ID)).toBe('k-fake')
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
        const account = testAccount('watch')
        const address = addressOn(account, testnet) as string
        slice().setAccountChainState(testnet, address, chainState('AUTH'))
        slice().setAccountChainState(mainnet, address, chainState())

        expect(authorityOf(account, testnet)).toBe('AUTH')
        expect(authorityOf(account, mainnet)).toBeNull()
    })

    test("is null for a scope the slice doesn't hold", () => {
        const account = testAccount('watch')
        const address = addressOn(account, mainnet) as string
        slice().setAccountChainState(mainnet, address, chainState('AUTH'))

        expect(authorityOf(account, testnet)).toBeNull()
    })

    test('is null for an account that signs for itself, and on any other chain', () => {
        const account = testAccount('watch')
        const address = addressOn(account, mainnet) as string
        slice().setAccountChainState(mainnet, address, chainState('AUTH'))

        expect(authorityOf(testAccount('local'), mainnet)).toBeNull()
        expect(
            authorityOf(account, { chainId: 'ethereum', networkId: 'mainnet' }),
        ).toBeNull()
    })

    test("another address's entry does not answer for this account", () => {
        slice().setAccountChainState(mainnet, 'OTHER', chainState('AUTH'))

        expect(authorityOf(testAccount('watch'), mainnet)).toBeNull()
    })
})

describe('seedOf', () => {
    const keys = [
        { id: 'seed', type: 'seed', metadata: { scheme: 'algo25' } },
        { id: 'child', type: 'ed25519', metadata: { parentKeyId: 'seed' } },
    ] as unknown as Keys

    const local = (keyPairId: string): WalletAccount =>
        buildTestAccount(TEST_CUSTODY.local, {
            [FAKE_CHAIN_ID]: { address: 'ADDR', keyPairId },
        })

    test('walks a child key to its seed', () => {
        expect(seedOf(local('child'), keys)).toBe('seed')
    })

    test('accepts a key id that is itself a seed', () => {
        expect(seedOf(local('seed'), keys)).toBe('seed')
    })

    test('reads the key from any chain the account is on', () => {
        const account = buildTestAccount(TEST_CUSTODY.local, {
            ethereum: { address: '0xabc', keyPairId: 'child' },
        })

        expect(seedOf(account, keys)).toBe('seed')
    })

    test('is undefined for a key the snapshot lacks', () => {
        expect(seedOf(local('missing'), keys)).toBeUndefined()
    })

    test.each(['hardware', 'multisig', 'watch'] as const)(
        'is undefined for a %s account',
        custody => {
            expect(seedOf(testAccount(custody), keys)).toBeUndefined()
        },
    )
})

describe('standaloneSecretOf', () => {
    const standaloneOn = (chainId: string): WalletAccount =>
        buildTestAccount(TEST_CUSTODY.local, {
            [chainId]: { address: 'ADDR', keyPairId: 'k' },
        })

    beforeEach(() => {
        registerChain('algorand', 'mnemonic')
        registerChain('ethereum', 'privateKey')
    })

    test('reads the secret format from the chain the account lives on', () => {
        expect(standaloneSecretOf(standaloneOn('algorand'))).toBe('mnemonic')
        expect(standaloneSecretOf(standaloneOn('ethereum'))).toBe('privateKey')
    })

    test('is undefined for any other custody', () => {
        for (const custody of [
            'explicit',
            'hd',
            'hardware',
            'watch',
        ] as const) {
            expect(standaloneSecretOf(testAccount(custody))).toBeUndefined()
        }
    })

    test('is undefined on a chain that is not registered', () => {
        getProvider().chains.reset()

        expect(standaloneSecretOf(standaloneOn('algorand'))).toBeUndefined()
    })
})

describe('isKeyReferenced', () => {
    test('finds a key on any chain entry', () => {
        const accounts = [
            testAccount('local', 'ADDR'),
            buildTestAccount(TEST_CUSTODY.local, {
                ethereum: { address: '0xabc', keyPairId: 'raw' },
            }),
        ]

        expect(isKeyReferenced(accounts, 'local-key')).toBe(true)
        expect(isKeyReferenced(accounts, 'raw')).toBe(true)
        expect(isKeyReferenced(accounts, 'other')).toBe(false)
    })
})
