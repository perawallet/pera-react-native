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
import { InvalidScopeKeyError, ScopeChangedError } from '../errors'
import type { ChainScope } from '../models/identity'

describe('ScopeChangedError', () => {
    it('carries both scopes and names them in its message', () => {
        const expected: ChainScope = {
            chainId: 'algorand',
            networkId: 'testnet',
        }
        const actual: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

        const error = new ScopeChangedError(expected, actual)

        expect(error).toBeInstanceOf(Error)
        expect(error).toBeInstanceOf(ScopeChangedError)
        expect(error.name).toBe('ScopeChangedError')
        expect(error.expected).toEqual(expected)
        expect(error.actual).toEqual(actual)
        expect(error.message).toContain('algorand/testnet')
        expect(error.message).toContain('algorand/mainnet')
    })

    it('can be built from a scope that is not a valid key', () => {
        const malformed: ChainScope = {
            chainId: 'algorand',
            networkId: 'Not Valid',
        }

        const build = () => new ScopeChangedError(malformed, malformed)

        expect(build).not.toThrow()
    })
})

describe('InvalidScopeKeyError', () => {
    it('carries the rejected key', () => {
        const error = new InvalidScopeKeyError('algorand')

        expect(error).toBeInstanceOf(Error)
        expect(error).toBeInstanceOf(InvalidScopeKeyError)
        expect(error.name).toBe('InvalidScopeKeyError')
        expect(error.key).toBe('algorand')
        expect(error.message).toBe('Invalid chain scope key: "algorand"')
    })
})
