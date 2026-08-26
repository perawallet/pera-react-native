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
import { decodeBytesToText, toBytes } from '../bytes'

describe('toBytes', () => {
    it('returns undefined for a string', () => {
        expect(toBytes('already decoded')).toBeUndefined()
    })

    it('returns a Uint8Array for an ArrayBuffer', () => {
        const arrayBuffer = new Uint8Array([104, 105, 33]).buffer
        expect(toBytes(arrayBuffer)).toEqual(new Uint8Array([104, 105, 33]))
    })

    it('returns a Uint8Array for a typed-array view', () => {
        const bytes = new Uint8Array([104, 105, 33])
        expect(toBytes(bytes)).toEqual(bytes)
    })

    it('returns undefined for a persisted-cache-poisoned index-keyed plain object', () => {
        const poisoned = JSON.parse(
            JSON.stringify(new Uint8Array([104, 105, 33])),
        )
        expect(poisoned).toEqual({ 0: 104, 1: 105, 2: 33 })
        expect(toBytes(poisoned)).toBeUndefined()
    })

    it('returns a Uint8Array for a persisted-cache Buffer-JSON shape', () => {
        const poisoned = JSON.parse(JSON.stringify(Buffer.from('hi!')))
        expect(poisoned).toEqual({ type: 'Buffer', data: [104, 105, 33] })
        expect(toBytes(poisoned)).toEqual(new Uint8Array([104, 105, 33]))
    })
})

describe('decodeBytesToText', () => {
    it('decodes a Uint8Array to its UTF-8 text', () => {
        const bytes = new Uint8Array([104, 105, 33])
        expect(decodeBytesToText(bytes)).toBe('hi!')
    })

    it('decodes a Buffer (Uint8Array subclass) to its UTF-8 text', () => {
        const buffer = Buffer.from('hello world')
        expect(decodeBytesToText(buffer)).toBe('hello world')
    })

    it('decodes an ArrayBuffer to its UTF-8 text', () => {
        const arrayBuffer = new Uint8Array([104, 105, 33]).buffer
        expect(decodeBytesToText(arrayBuffer)).toBe('hi!')
    })

    it('returns a string input unchanged', () => {
        expect(decodeBytesToText('already decoded')).toBe('already decoded')
    })

    it('returns undefined for a persisted-cache-poisoned index-keyed plain object', () => {
        const poisoned = JSON.parse(
            JSON.stringify(new Uint8Array([104, 105, 33])),
        )
        expect(poisoned).toEqual({ 0: 104, 1: 105, 2: 33 })
        expect(decodeBytesToText(poisoned)).toBeUndefined()
    })

    it('decodes a persisted-cache Buffer-JSON shape to its UTF-8 text', () => {
        const poisoned = JSON.parse(JSON.stringify(Buffer.from('hi!')))
        expect(poisoned).toEqual({ type: 'Buffer', data: [104, 105, 33] })
        expect(decodeBytesToText(poisoned)).toBe('hi!')
    })

    it('returns undefined for null', () => {
        expect(decodeBytesToText(null)).toBeUndefined()
    })

    it('returns undefined for undefined', () => {
        expect(decodeBytesToText(undefined)).toBeUndefined()
    })

    it('returns undefined for a number', () => {
        expect(decodeBytesToText(42)).toBeUndefined()
    })

    it('returns undefined for a plain array', () => {
        expect(decodeBytesToText([104, 105, 33])).toBeUndefined()
    })

    it('returns undefined for an empty Uint8Array', () => {
        expect(decodeBytesToText(new Uint8Array([]))).toBeUndefined()
    })

    it('returns undefined for an empty string', () => {
        expect(decodeBytesToText('')).toBeUndefined()
    })
})
