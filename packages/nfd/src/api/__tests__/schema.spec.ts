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

import { describe, it, expect } from 'vitest'
import { nfdBulkReadResponseSchema, nameSearchResponseSchema } from '../schema'

describe('nfdBulkReadResponseSchema', () => {
    it('parses a valid bulk response', () => {
        const data = {
            results: [
                {
                    address: 'ABC123',
                    name: {
                        name: 'alice.algo',
                        source: 'nfdomain',
                        image: 'https://example.com/img.png',
                    },
                },
                {
                    address: 'DEF456',
                    name: { name: 'alice.eth', source: 'ens', image: null },
                },
                {
                    address: 'GHI789',
                    name: null,
                },
            ],
        }

        const result = nfdBulkReadResponseSchema.parse(data)

        expect(result.results).toHaveLength(3)
        expect(result.results[0].name?.name).toBe('alice.algo')
        expect(result.results[1].name?.image).toBeNull()
        expect(result.results[2].name).toBeNull()
    })

    it('rejects a response that is not a results list', () => {
        expect(() => nfdBulkReadResponseSchema.parse({ wrong: 1 })).toThrow()
    })
})

describe('nameSearchResponseSchema', () => {
    it('parses a valid search response carrying the chain', () => {
        const data = {
            count: 1,
            results: [
                {
                    name: 'alice.eth',
                    address: 'ABC123',
                    chain: 'eip155:8453',
                    service: {
                        name: 'ENS',
                        logo: 'https://example.com/logo.png',
                    },
                },
            ],
        }

        const result = nameSearchResponseSchema.parse(data)

        expect(result.count).toBe(1)
        expect(result.results[0].chain).toBe('eip155:8453')
    })

    it('rejects a result without a chain', () => {
        const data = {
            count: 1,
            results: [
                {
                    name: 'alice.eth',
                    address: 'ABC123',
                    service: { name: 'ENS', logo: '' },
                },
            ],
        }

        expect(() => nameSearchResponseSchema.parse(data)).toThrow()
    })
})
