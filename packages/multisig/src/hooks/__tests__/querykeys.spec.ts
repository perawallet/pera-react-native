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

import { describe, test, expect } from 'vitest'
import {
    getMultisigAccountDetailQueryKey,
    getSignRequestDetailQueryKey,
} from '../querykeys'

describe('getMultisigAccountDetailQueryKey', () => {
    test('returns array with correct structure for mainnet', () => {
        const result = getMultisigAccountDetailQueryKey('mainnet', 'MSIG_ADDR')

        expect(result).toEqual([
            'multisig',
            'account-detail',
            { network: 'mainnet', address: 'MSIG_ADDR' },
        ])
    })

    test('returns array with correct structure for testnet', () => {
        const result = getMultisigAccountDetailQueryKey(
            'testnet',
            'TEST_ADDR_123',
        )

        expect(result).toEqual([
            'multisig',
            'account-detail',
            { network: 'testnet', address: 'TEST_ADDR_123' },
        ])
    })

    test('includes address in the key params', () => {
        const result = getMultisigAccountDetailQueryKey(
            'mainnet',
            'UNIQUE_ADDRESS',
        )

        expect(result[2]).toHaveProperty('address', 'UNIQUE_ADDRESS')
    })

    test('includes network in the key params', () => {
        const result = getMultisigAccountDetailQueryKey('testnet', 'ADDR')

        expect(result[2]).toHaveProperty('network', 'testnet')
    })

    test('returns unique keys for different addresses', () => {
        const key1 = getMultisigAccountDetailQueryKey('mainnet', 'ADDR1')
        const key2 = getMultisigAccountDetailQueryKey('mainnet', 'ADDR2')

        expect(key1).not.toEqual(key2)
    })

    test('returns unique keys for different networks', () => {
        const key1 = getMultisigAccountDetailQueryKey('mainnet', 'ADDR')
        const key2 = getMultisigAccountDetailQueryKey('testnet', 'ADDR')

        expect(key1).not.toEqual(key2)
    })
})

describe('getSignRequestDetailQueryKey', () => {
    test('returns array with correct structure for mainnet', () => {
        const result = getSignRequestDetailQueryKey('mainnet', 'sr-123')

        expect(result).toEqual([
            'multisig',
            'sign-request-detail',
            { network: 'mainnet', signRequestId: 'sr-123' },
        ])
    })

    test('returns array with correct structure for testnet', () => {
        const result = getSignRequestDetailQueryKey('testnet', 'sr-456')

        expect(result).toEqual([
            'multisig',
            'sign-request-detail',
            { network: 'testnet', signRequestId: 'sr-456' },
        ])
    })

    test('includes signRequestId in the key params', () => {
        const result = getSignRequestDetailQueryKey('mainnet', 'unique-sr-id')

        expect(result[2]).toHaveProperty('signRequestId', 'unique-sr-id')
    })

    test('includes network in the key params', () => {
        const result = getSignRequestDetailQueryKey('testnet', 'sr-1')

        expect(result[2]).toHaveProperty('network', 'testnet')
    })

    test('returns unique keys for different sign request IDs', () => {
        const key1 = getSignRequestDetailQueryKey('mainnet', 'sr-1')
        const key2 = getSignRequestDetailQueryKey('mainnet', 'sr-2')

        expect(key1).not.toEqual(key2)
    })

    test('returns unique keys for different networks', () => {
        const key1 = getSignRequestDetailQueryKey('mainnet', 'sr-1')
        const key2 = getSignRequestDetailQueryKey('testnet', 'sr-1')

        expect(key1).not.toEqual(key2)
    })
})
