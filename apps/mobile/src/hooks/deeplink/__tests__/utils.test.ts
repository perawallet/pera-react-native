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
    parseQueryParams,
    decodeBase64Param,
    normalizeUrl,
    extractPath,
} from '../utils'

describe('Deeplink Parser - Helper Functions', () => {
    describe('parseQueryParams', () => {
        it('parses basic query parameters', () => {
            const params = parseQueryParams(
                'perawallet://test?amount=100&note=hello',
            )
            expect(params.amount).toBe('100')
            expect(params.note).toBe('hello')
        })

        it('handles URL-encoded values', () => {
            const params = parseQueryParams(
                'perawallet://test?label=HELLO%20WORLD%20LABEL',
            )
            expect(params.label).toBe('HELLO WORLD LABEL')
        })

        it('handles missing query string', () => {
            const params = parseQueryParams('perawallet://test')
            expect(params).toEqual({})
        })

        it('handles empty values', () => {
            const params = parseQueryParams(
                'perawallet://test?key1=&key2=value',
            )
            expect(params.key1).toBe('')
            expect(params.key2).toBe('value')
        })
        it('handles malformed URL in parseQueryParams', () => {
            // This triggers the catch block in parseQueryParams because 'invalid' is not a valid URL
            // and then it falls back to manual parsing
            const params = parseQueryParams('invalid?foo=bar&baz=qux')
            expect(params.foo).toBe('bar')
            expect(params.baz).toBe('qux')
        })

        it('handles malformed URL without query params', () => {
            const params = parseQueryParams('invalid')
            expect(params).toEqual({})
        })
    })

    describe('decodeBase64Param', () => {
        it('decodes valid base64 string', () => {
            const encoded = btoa('https://perawallet.app/')
            const decoded = decodeBase64Param(encoded)
            expect(decoded).toBe('https://perawallet.app/')
        })

        it('returns original string if not base64', () => {
            const result = decodeBase64Param('not-base64!')
            expect(result).toBe('not-base64!')
        })

        it('handles exception in decodeBase64Param', () => {
            // Mock Buffer.from to throw to test catch block
            const originalBufferFrom = Buffer.from
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            global.Buffer.from = ((_str: string, _enc: string) => {
                throw new Error('Mock Error')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }) as any

            expect(decodeBase64Param('SGVsbG8=')).toBe('SGVsbG8=')

            global.Buffer.from = originalBufferFrom
        })
    })

    describe('normalizeUrl', () => {
        it('trims whitespace', () => {
            expect(normalizeUrl('  perawallet://test  ')).toBe(
                'perawallet://test',
            )
        })
    })

    describe('extractPath', () => {
        it('extracts path from app URL', () => {
            expect(extractPath('perawallet://app/test/path?query=1')).toBe(
                'test/path',
            )
        })

        it('returns empty string if no app path', () => {
            expect(extractPath('perawallet://test')).toBe('')
        })

        it('handles exception in extractPath', () => {
            // Pass invalid type to trigger catch
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect(extractPath(null as any)).toBe('')
        })
    })
})
