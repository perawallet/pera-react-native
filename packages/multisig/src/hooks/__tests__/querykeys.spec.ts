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
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import {
    getMultisigAccountDetailQueryKey,
    getSignRequestDetailQueryKey,
} from '../querykeys'

const MAINNET = scopeForLegacyNetwork('mainnet')
const TESTNET = scopeForLegacyNetwork('testnet')

describe('getMultisigAccountDetailQueryKey', () => {
    test('returns array with correct structure for mainnet', () => {
        const result = getMultisigAccountDetailQueryKey(MAINNET, 'MSIG_ADDR')

        expect(result).toEqual([
            'multisig',
            'account-detail',
            { scope: MAINNET, address: 'MSIG_ADDR' },
        ])
    })

    test('returns array with correct structure for testnet', () => {
        const result = getMultisigAccountDetailQueryKey(
            TESTNET,
            'TEST_ADDR_123',
        )

        expect(result).toEqual([
            'multisig',
            'account-detail',
            { scope: TESTNET, address: 'TEST_ADDR_123' },
        ])
    })

    test('includes address in the key params', () => {
        const result = getMultisigAccountDetailQueryKey(
            MAINNET,
            'UNIQUE_ADDRESS',
        )

        expect(result[2]).toHaveProperty('address', 'UNIQUE_ADDRESS')
    })

    test('includes scope in the key params', () => {
        const result = getMultisigAccountDetailQueryKey(TESTNET, 'ADDR')

        expect(result[2]).toHaveProperty('scope', TESTNET)
    })

    test('returns unique keys for different addresses', () => {
        const key1 = getMultisigAccountDetailQueryKey(MAINNET, 'ADDR1')
        const key2 = getMultisigAccountDetailQueryKey(MAINNET, 'ADDR2')

        expect(key1).not.toEqual(key2)
    })

    test('returns unique keys for different scopes', () => {
        const key1 = getMultisigAccountDetailQueryKey(MAINNET, 'ADDR')
        const key2 = getMultisigAccountDetailQueryKey(TESTNET, 'ADDR')

        expect(key1).not.toEqual(key2)
    })
})

describe('getSignRequestDetailQueryKey', () => {
    test('returns array with correct structure for mainnet', () => {
        const result = getSignRequestDetailQueryKey(MAINNET, 'sr-123')

        expect(result).toEqual([
            'multisig',
            'sign-request-detail',
            { scope: MAINNET, signRequestId: 'sr-123' },
        ])
    })

    test('returns array with correct structure for testnet', () => {
        const result = getSignRequestDetailQueryKey(TESTNET, 'sr-456')

        expect(result).toEqual([
            'multisig',
            'sign-request-detail',
            { scope: TESTNET, signRequestId: 'sr-456' },
        ])
    })

    test('includes signRequestId in the key params', () => {
        const result = getSignRequestDetailQueryKey(MAINNET, 'unique-sr-id')

        expect(result[2]).toHaveProperty('signRequestId', 'unique-sr-id')
    })

    test('includes scope in the key params', () => {
        const result = getSignRequestDetailQueryKey(TESTNET, 'sr-1')

        expect(result[2]).toHaveProperty('scope', TESTNET)
    })

    test('returns unique keys for different sign request IDs', () => {
        const key1 = getSignRequestDetailQueryKey(MAINNET, 'sr-1')
        const key2 = getSignRequestDetailQueryKey(MAINNET, 'sr-2')

        expect(key1).not.toEqual(key2)
    })

    test('returns unique keys for different scopes', () => {
        const key1 = getSignRequestDetailQueryKey(MAINNET, 'sr-1')
        const key2 = getSignRequestDetailQueryKey(TESTNET, 'sr-1')

        expect(key1).not.toEqual(key2)
    })
})
