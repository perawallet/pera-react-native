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
import { Decimal } from 'decimal.js'
import type {
    AccountChainState,
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
    seedOf,
    signingKeyOn,
} from '../accessors'

type Keys = NonNullable<Parameters<typeof seedOf>[1]>

const mainnet: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const testnet: ChainScope = { chainId: 'algorand', networkId: 'testnet' }

const withoutChains = (type: AccountType): WalletAccount => {
    const { chains: _chains, ...rest } = buildTestAccount(type)
    return rest as WalletAccount
}

const TYPES = [
    'algo25',
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
            type === 'hdWallet' || type === 'algo25' || type === 'quantum'
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
        expect(hdIndexOf(buildTestAccount('algo25'))).toBeUndefined()
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
        const account = buildTestAccount('algo25')
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

    const rekeyed = (patch: Partial<WalletAccount>): WalletAccount => ({
        ...buildTestAccount('watch'),
        ...patch,
    })

    test('reads the requested network of the per-network map', () => {
        const account = rekeyed({ rekeyAddressByNetwork: { testnet: 'AUTH' } })

        expect(authorityOf(account, testnet)).toBe('AUTH')
        expect(authorityOf(account, mainnet)).toBeNull()
    })

    test('falls back to the mirror when the account predates the map', () => {
        expect(authorityOf(rekeyed({ rekeyAddress: 'AUTH' }), mainnet)).toBe(
            'AUTH',
        )
    })

    test('ignores the mirror once the map exists', () => {
        const account = rekeyed({
            rekeyAddress: 'STALE',
            rekeyAddressByNetwork: {},
        })

        expect(authorityOf(account, mainnet)).toBeNull()
    })

    test('is null for an account that signs for itself, and on any other chain', () => {
        expect(authorityOf(buildTestAccount('watch'), mainnet)).toBeNull()
        expect(
            authorityOf(rekeyed({ rekeyAddress: 'AUTH' }), {
                chainId: 'ethereum',
                networkId: 'mainnet',
            }),
        ).toBeNull()
    })

    test('reads the slice per scope, not the stale mirror', () => {
        const account = rekeyed({ rekeyAddress: 'STALE' })
        const address = addressOn(account, testnet) as string
        slice().setAccountChainState(testnet, address, chainState('AUTH'))
        slice().setAccountChainState(mainnet, address, chainState())

        expect(authorityOf(account, testnet)).toBe('AUTH')
        expect(authorityOf(account, mainnet)).toBeNull()
    })

    test('a slice entry beats the per-network map for the same scope', () => {
        const account = rekeyed({ rekeyAddressByNetwork: { mainnet: 'OLD' } })
        const address = addressOn(account, mainnet) as string
        slice().setAccountChainState(mainnet, address, chainState('NEW'))

        expect(authorityOf(account, mainnet)).toBe('NEW')
    })

    test("another address's entry does not answer for this account", () => {
        const account = rekeyed({ rekeyAddressByNetwork: { mainnet: 'MAP' } })
        slice().setAccountChainState(mainnet, 'OTHER', chainState('AUTH'))

        expect(authorityOf(account, mainnet)).toBe('MAP')
    })
})

describe('seedOf', () => {
    const keys = [
        { id: 'seed', type: 'seed', metadata: { scheme: 'algo25' } },
        { id: 'child', type: 'ed25519', metadata: { parentKeyId: 'seed' } },
    ] as unknown as Keys

    const local = (keyPairId: string): WalletAccount => ({
        ...buildTestAccount('algo25'),
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
