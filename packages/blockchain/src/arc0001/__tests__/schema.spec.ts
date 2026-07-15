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
import { arc0001SignTxnRequestSchema } from '../schema'

describe('arc0001SignTxnRequestSchema', () => {
    it('accepts the minimal shape — a single entry with just txn', () => {
        const result = arc0001SignTxnRequestSchema.safeParse([{ txn: 'AAAA' }])
        expect(result.success).toBe(true)
    })

    it('accepts every documented optional field', () => {
        const result = arc0001SignTxnRequestSchema.safeParse([
            {
                txn: 'AAAA',
                signers: ['addr1'],
                authAddr: 'addr2',
                msig: {
                    version: 1,
                    threshold: 2,
                    addrs: ['addr1', 'addr2'],
                },
                stxn: 'BBBB',
                message: 'sign me',
                groupMessage: 'group of two',
            },
        ])
        expect(result.success).toBe(true)
    })

    it('rejects when txn is missing', () => {
        const result = arc0001SignTxnRequestSchema.safeParse([{}])
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0].path).toEqual([0, 'txn'])
        }
    })

    it('rejects when txn is an empty string', () => {
        const result = arc0001SignTxnRequestSchema.safeParse([{ txn: '' }])
        expect(result.success).toBe(false)
    })

    it('rejects when signers is not an array', () => {
        const result = arc0001SignTxnRequestSchema.safeParse([
            { txn: 'AAAA', signers: 'addr1' },
        ])
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0].path).toEqual([0, 'signers'])
        }
    })

    it('accepts empty signers array (signers: [] is spec-meaningful)', () => {
        const result = arc0001SignTxnRequestSchema.safeParse([
            { txn: 'AAAA', signers: [] },
        ])
        expect(result.success).toBe(true)
    })

    it('rejects when msig is missing a required field', () => {
        const result = arc0001SignTxnRequestSchema.safeParse([
            {
                txn: 'AAAA',
                msig: { version: 1, addrs: ['addr1'] }, // no threshold
            },
        ])
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0].path).toEqual([
                0,
                'msig',
                'threshold',
            ])
        }
    })

    it('rejects when msig.threshold is not an integer', () => {
        const result = arc0001SignTxnRequestSchema.safeParse([
            {
                txn: 'AAAA',
                msig: { version: 1, threshold: 'two', addrs: ['addr1'] },
            },
        ])
        expect(result.success).toBe(false)
    })

    it('rejects unknown extra fields (spec: "unknown extra fields ... all → reject")', () => {
        const result = arc0001SignTxnRequestSchema.safeParse([
            { txn: 'AAAA', unknownField: 'lol' },
        ])
        expect(result.success).toBe(false)
        if (!result.success) {
            // zod reports unrecognized keys against the object's own path,
            // carrying the offending key names in the issue itself.
            expect(result.error.issues[0].code).toBe('unrecognized_keys')
            expect(
                (result.error.issues[0] as { keys?: string[] }).keys,
            ).toEqual(['unknownField'])
        }
    })

    it('rejects an oversized txn (defence-in-depth byte cap)', () => {
        const result = arc0001SignTxnRequestSchema.safeParse([
            { txn: 'A'.repeat(64 * 1024 + 1) },
        ])
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0].path).toEqual([0, 'txn'])
        }
    })

    it('rejects an oversized message string', () => {
        const result = arc0001SignTxnRequestSchema.safeParse([
            { txn: 'AAAA', message: 'x'.repeat(4 * 1024 + 1) },
        ])
        expect(result.success).toBe(false)
    })

    it('rejects an msig.addrs list longer than the participant cap', () => {
        const result = arc0001SignTxnRequestSchema.safeParse([
            {
                txn: 'AAAA',
                msig: {
                    version: 1,
                    threshold: 2,
                    addrs: Array.from({ length: 257 }, () => 'addr'),
                },
            },
        ])
        expect(result.success).toBe(false)
    })

    it('rejects when the top-level payload is not an array', () => {
        const result = arc0001SignTxnRequestSchema.safeParse({ txn: 'AAAA' })
        expect(result.success).toBe(false)
    })

    it('reports the offending entry index in the path for nested violations', () => {
        const result = arc0001SignTxnRequestSchema.safeParse([
            { txn: 'AAAA' },
            { txn: 'BBBB', signers: 'not-an-array' },
            { txn: 'CCCC' },
        ])
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error.issues[0].path).toEqual([1, 'signers'])
        }
    })
})
