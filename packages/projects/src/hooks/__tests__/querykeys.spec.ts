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
import { queryKeyReferencesScope } from '@perawallet/wallet-core-chain-contract'
import { projectQueryKeys } from '../querykeys'

const MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const
const TESTNET = { chainId: 'algorand', networkId: 'testnet' } as const

describe('projectQueryKeys', () => {
    describe('byUrl', () => {
        test('includes the url and scope in the key', () => {
            const key = projectQueryKeys.byUrl('https://a.example', MAINNET)

            expect(key).toEqual([
                'projects',
                'by-url',
                { url: 'https://a.example', scope: MAINNET },
            ])
        })

        test('produces different keys for different scopes', () => {
            const key1 = projectQueryKeys.byUrl('https://a.example', MAINNET)
            const key2 = projectQueryKeys.byUrl('https://a.example', TESTNET)

            expect(key1).not.toEqual(key2)
        })
    })

    test('every key references its scope', () => {
        expect(
            queryKeyReferencesScope(
                projectQueryKeys.byUrl('https://a.example', MAINNET),
                MAINNET,
            ),
        ).toBe(true)
        expect(
            queryKeyReferencesScope(
                projectQueryKeys.application('123', MAINNET),
                MAINNET,
            ),
        ).toBe(true)
    })

    describe('discover', () => {
        test('sorts the chains so their order never splits the cache', () => {
            expect(
                projectQueryKeys.discover('live', 'ios', ['b', 'a']),
            ).toEqual([
                'projects',
                'discover',
                { deployment: 'live', platform: 'ios', chains: ['a', 'b'] },
            ])
        })
    })

    describe('application', () => {
        test('includes the application id and scope in the key', () => {
            const key = projectQueryKeys.application('123', MAINNET)

            expect(key).toEqual([
                'projects',
                'application',
                { applicationId: '123', scope: MAINNET },
            ])
        })

        test('produces different keys for different scopes', () => {
            const key1 = projectQueryKeys.application('123', MAINNET)
            const key2 = projectQueryKeys.application('123', TESTNET)

            expect(key1).not.toEqual(key2)
        })
    })
})
