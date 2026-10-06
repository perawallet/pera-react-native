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
import { InvalidScopeKeyError } from '../errors'
import {
    CHAIN_IDS,
    LEGACY_NETWORKS,
    type ChainId,
    type ChainScope,
} from '../models/identity'
import {
    LEGACY_SCOPES,
    legacyNetworkOf,
    parseScopeKey,
    queryKeyReferencesScope,
    rekeyLegacyNetworkRecord,
    scopeForLegacyNetwork,
    scopeFromNetworkColumn,
    scopeKeyForLegacyNetwork,
    toScopeKey,
} from '../scope'

const NETWORK_IDS = [
    'mainnet',
    'testnet',
    'betanet',
    'custom',
    'custom-9f3a',
    'a-b-c',
]

// As if read from storage written by a newer build.
const UNKNOWN_CHAIN_SCOPE: ChainScope = {
    chainId: 'unknown' as unknown as ChainId,
    networkId: 'mainnet',
}

describe('toScopeKey', () => {
    it('joins the chain id and the network id with a slash', () => {
        const key = toScopeKey({ chainId: 'algorand', networkId: 'mainnet' })

        expect(key).toBe('algorand/mainnet')
    })

    it.each(['', 'MainNet', 'main net', 'main/net', 'mainnet\n'])(
        'rejects the network id %j',
        networkId => {
            const convert = () => toScopeKey({ chainId: 'algorand', networkId })

            expect(convert).toThrow(InvalidScopeKeyError)
        },
    )

    it('rejects a chain id this build does not know', () => {
        expect(() => toScopeKey(UNKNOWN_CHAIN_SCOPE)).toThrow(
            InvalidScopeKeyError,
        )
    })
})

describe('parseScopeKey', () => {
    const scopes: ChainScope[] = CHAIN_IDS.flatMap(chainId =>
        NETWORK_IDS.map(networkId => ({ chainId, networkId })),
    )

    it.each(scopes)('round-trips $chainId/$networkId', scope => {
        const parsed = parseScopeKey(toScopeKey(scope))

        expect(parsed).toEqual(scope)
    })

    it.each([
        '',
        'algorand',
        '/mainnet',
        'algorand/',
        'unknown/mainnet',
        'Algorand/mainnet',
        'algorand/MainNet',
        'algorand/main/net',
        'algorand/mainnet\n',
        'algorand:mainnet',
        'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k',
    ])('rejects %j', key => {
        expect(() => parseScopeKey(key)).toThrow(InvalidScopeKeyError)
    })

    it('names the rejected key in the error', () => {
        expect(() => parseScopeKey('algorand:mainnet')).toThrow(
            new InvalidScopeKeyError('algorand:mainnet'),
        )
    })
})

describe('scopeForLegacyNetwork', () => {
    it.each([
        ['mainnet', 'algorand/mainnet'],
        ['testnet', 'algorand/testnet'],
        ['betanet', 'algorand/betanet'],
        ['custom', 'algorand/custom'],
    ] as const)('maps %s to %s', (network, key) => {
        const scope = scopeForLegacyNetwork(network)

        expect(scope).toEqual({ chainId: 'algorand', networkId: network })
        expect(toScopeKey(scope)).toBe(key)
    })
})

describe('network column encoding', () => {
    it.each(LEGACY_NETWORKS)(
        'stores the Algorand %s scope as its scope key',
        network => {
            expect(toScopeKey(scopeForLegacyNetwork(network))).toBe(
                `algorand/${network}`,
            )
        },
    )

    it.each(LEGACY_NETWORKS)(
        'decodes a bare %s value to the Algorand scope',
        network => {
            expect(scopeFromNetworkColumn(network)).toEqual(
                scopeForLegacyNetwork(network),
            )
        },
    )

    it('decodes a scope key', () => {
        expect(scopeFromNetworkColumn('algorand/testnet')).toEqual({
            chainId: 'algorand',
            networkId: 'testnet',
        })
    })

    it('rejects a bare value that is not a known network', () => {
        expect(() => scopeFromNetworkColumn('devnet')).toThrow(
            InvalidScopeKeyError,
        )
    })

    it('rejects a scope key for an unknown chain', () => {
        expect(() => scopeFromNetworkColumn('ethereum/mainnet')).toThrow(
            InvalidScopeKeyError,
        )
    })
})

describe('LEGACY_SCOPES', () => {
    it('holds the Algorand scope of every legacy network', () => {
        expect(LEGACY_SCOPES).toEqual(
            LEGACY_NETWORKS.map(scopeForLegacyNetwork),
        )
    })
})

describe('queryKeyReferencesScope', () => {
    const testnet = scopeForLegacyNetwork('testnet')

    it('matches the scope in the scope field of an object element', () => {
        const key = ['assets', { assetId: '1', scope: testnet }]

        expect(queryKeyReferencesScope(key, testnet)).toBe(true)
    })

    it('matches the scope as a bare element', () => {
        const key = ['rekey-transaction-fee', { ...testnet }, 'ADDR']

        expect(queryKeyReferencesScope(key, testnet)).toBe(true)
    })

    it('does not match a key for another scope', () => {
        const mainnet = scopeForLegacyNetwork('mainnet')
        const key = ['assets', { assetId: '1', scope: mainnet }, mainnet]

        expect(queryKeyReferencesScope(key, testnet)).toBe(false)
    })

    it('does not match the same network id on another chain', () => {
        const key = [
            'assets',
            { scope: { chainId: 'other', networkId: 'testnet' } },
        ]

        expect(queryKeyReferencesScope(key, testnet)).toBe(false)
    })

    it('does not match a key shaped before scopes, with a bare network', () => {
        const key = ['assets', { assetId: '1', network: 'testnet' }, 'testnet']

        expect(queryKeyReferencesScope(key, testnet)).toBe(false)
    })

    it('rejects a scope that is not valid', () => {
        expect(() =>
            queryKeyReferencesScope(['assets'], UNKNOWN_CHAIN_SCOPE),
        ).toThrow(InvalidScopeKeyError)
    })

    it('does not match a key that carries no network', () => {
        const key = ['assets', null, { assetId: '1' }]

        expect(queryKeyReferencesScope(key, testnet)).toBe(false)
    })
})

describe('scopeKeyForLegacyNetwork', () => {
    it.each(LEGACY_NETWORKS)('keys %s under the Algorand chain', network => {
        expect(scopeKeyForLegacyNetwork(network)).toBe(`algorand/${network}`)
    })
})

describe('legacyNetworkOf', () => {
    it.each(LEGACY_NETWORKS)('round-trips the Algorand %s scope', network => {
        expect(legacyNetworkOf(scopeForLegacyNetwork(network))).toBe(network)
    })

    it('rejects a network of the legacy chain that has no legacy value', () => {
        expect(() =>
            legacyNetworkOf({ chainId: 'algorand', networkId: 'custom-9f3a' }),
        ).toThrow(InvalidScopeKeyError)
    })

    it('rejects another chain', () => {
        expect(() => legacyNetworkOf(UNKNOWN_CHAIN_SCOPE)).toThrow(
            InvalidScopeKeyError,
        )
    })
})

describe('rekeyLegacyNetworkRecord', () => {
    it('re-keys bare legacy networks to scope keys, values unchanged', () => {
        const rekeyed = rekeyLegacyNetworkRecord({
            mainnet: 'id-main',
            testnet: null,
        })

        expect(rekeyed).toEqual({
            'algorand/mainnet': 'id-main',
            'algorand/testnet': null,
        })
    })

    it('passes keys that already are scope keys through', () => {
        const migrated = { 'algorand/testnet': 42 }

        expect(rekeyLegacyNetworkRecord(migrated)).toEqual(migrated)
    })

    it('drops keys it cannot read instead of throwing', () => {
        const rekeyed = rekeyLegacyNetworkRecord({
            mainnet: 1,
            devnet: 2,
            'ethereum/mainnet': 3,
        })

        expect(rekeyed).toEqual({ 'algorand/mainnet': 1 })
    })

    it('treats a missing record as empty', () => {
        expect(rekeyLegacyNetworkRecord(undefined)).toEqual({})
    })
})
