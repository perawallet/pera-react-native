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

import { describe, it, expect } from 'vitest'
import {
    nfdNamesListResponseSchema,
    nfdBulkReadResponseSchema,
    nfdSearchResponseSchema,
} from '../schema'

describe('nfdNamesListResponseSchema', () => {
    it('parses a valid response with results', () => {
        const data = {
            results: [
                {
                    name: 'alice.algo',
                    source: 'nfd',
                    image: 'https://example.com/alice.png',
                },
            ],
        }

        const result = nfdNamesListResponseSchema.parse(data)

        expect(result.results).toHaveLength(1)
        expect(result.results[0].name).toBe('alice.algo')
    })

    it('parses a response with empty results', () => {
        const data = { results: [] }

        const result = nfdNamesListResponseSchema.parse(data)

        expect(result.results).toHaveLength(0)
    })

    it('rejects a response missing the name field', () => {
        const data = {
            results: [{ source: 'nfd', image: 'https://example.com/img.png' }],
        }

        expect(() => nfdNamesListResponseSchema.parse(data)).toThrow()
    })

    it('rejects a response with empty name', () => {
        const data = {
            results: [
                {
                    name: '',
                    source: 'nfd',
                    image: 'https://example.com/img.png',
                },
            ],
        }

        expect(() => nfdNamesListResponseSchema.parse(data)).toThrow()
    })
})

describe('nfdBulkReadResponseSchema', () => {
    it('parses a valid bulk response', () => {
        const data = {
            results: [
                {
                    address: 'ABC123',
                    name: {
                        name: 'alice.algo',
                        source: 'nfd',
                        image: 'https://example.com/img.png',
                    },
                },
                {
                    address: 'DEF456',
                    name: null,
                },
            ],
        }

        const result = nfdBulkReadResponseSchema.parse(data)

        expect(result.results).toHaveLength(2)
        expect(result.results[0].name?.name).toBe('alice.algo')
        expect(result.results[1].name).toBeNull()
    })
})

describe('nfdSearchResponseSchema', () => {
    it('parses a valid search response', () => {
        const data = {
            count: 1,
            results: [
                {
                    name: 'alice.algo',
                    address: 'ABC123',
                    service: {
                        name: 'NFD',
                        logo: 'https://example.com/logo.png',
                    },
                },
            ],
        }

        const result = nfdSearchResponseSchema.parse(data)

        expect(result.count).toBe(1)
        expect(result.results[0].address).toBe('ABC123')
    })
})
