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
import { isConnection } from '../models'

describe('isConnection', () => {
    const valid = {
        id: 'client-1',
        kind: 'walletconnect-v1',
        name: 'Tinyman',
        peer: { name: 'Tinyman' },
        accounts: ['AAAA'],
        status: 'active',
        createdAt: 1,
        lastActiveAt: 2,
    }

    it('accepts a well-formed record', () => {
        expect(isConnection(valid)).toBe(true)
    })

    it('rejects a record missing its kind', () => {
        const { kind, ...withoutKind } = valid
        expect(isConnection(withoutKind)).toBe(false)
    })

    it('rejects a record whose accounts are not strings', () => {
        expect(isConnection({ ...valid, accounts: [1] })).toBe(false)
    })

    it('rejects null and primitives', () => {
        expect(isConnection(null)).toBe(false)
        expect(isConnection('connection')).toBe(false)
    })
})
