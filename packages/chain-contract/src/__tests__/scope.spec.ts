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
import { CHAIN_IDS, type ChainId, type ChainScope } from '../models/identity'
import {
    legacyColumnValue,
    parseScopeKey,
    scopeForLegacyNetwork,
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

describe('legacyColumnValue', () => {
    it.each(['mainnet', 'testnet', 'betanet', 'custom'] as const)(
        'is the bare legacy value for %s',
        network => {
            const value = legacyColumnValue(scopeForLegacyNetwork(network))

            expect(value).toBe(network)
        },
    )

    it('is the bare network id for any other network of the legacy chain', () => {
        const value = legacyColumnValue({
            chainId: 'algorand',
            networkId: 'custom-9f3a',
        })

        expect(value).toBe('custom-9f3a')
    })

    it('rejects a network id that is not valid', () => {
        const scope: ChainScope = {
            chainId: 'algorand',
            networkId: 'Not Valid',
        }

        expect(() => legacyColumnValue(scope)).toThrow(InvalidScopeKeyError)
    })

    it('rejects a chain id this build does not know', () => {
        expect(() => legacyColumnValue(UNKNOWN_CHAIN_SCOPE)).toThrow(
            InvalidScopeKeyError,
        )
    })
})
