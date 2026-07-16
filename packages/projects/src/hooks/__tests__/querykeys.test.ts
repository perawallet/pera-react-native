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
import { projectQueryKeys } from '../querykeys'

describe('projectQueryKeys', () => {
    describe('byUrl', () => {
        test('includes the url and network in the key', () => {
            const key = projectQueryKeys.byUrl('https://a.example', 'mainnet')

            expect(key).toEqual([
                'projects',
                'by-url',
                { url: 'https://a.example', network: 'mainnet' },
            ])
        })

        test('produces different keys for different networks', () => {
            const key1 = projectQueryKeys.byUrl('https://a.example', 'mainnet')
            const key2 = projectQueryKeys.byUrl('https://a.example', 'testnet')

            expect(key1).not.toEqual(key2)
        })
    })

    describe('application', () => {
        test('includes the application id and network in the key', () => {
            const key = projectQueryKeys.application('123', 'mainnet')

            expect(key).toEqual([
                'projects',
                'application',
                { applicationId: '123', network: 'mainnet' },
            ])
        })

        test('produces different keys for different networks', () => {
            const key1 = projectQueryKeys.application('123', 'mainnet')
            const key2 = projectQueryKeys.application('123', 'testnet')

            expect(key1).not.toEqual(key2)
        })
    })
})
