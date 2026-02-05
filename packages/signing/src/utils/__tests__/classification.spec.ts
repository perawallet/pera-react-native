/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { classifyTransactionGroups } from '../classification'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'

const tx = {} as PeraDisplayableTransaction

describe('classifyTransactionGroups', () => {
    test('returns single for empty groups', () => {
        expect(classifyTransactionGroups([])).toBe('single')
    })

    test('returns single for one transaction in one group', () => {
        expect(classifyTransactionGroups([[tx]])).toBe('single')
    })

    test('returns group for multiple transactions in one group', () => {
        expect(classifyTransactionGroups([[tx, tx, tx]])).toBe('group')
    })

    test('returns group-list for multiple groups', () => {
        expect(classifyTransactionGroups([[tx], [tx, tx]])).toBe('group-list')
    })
})
