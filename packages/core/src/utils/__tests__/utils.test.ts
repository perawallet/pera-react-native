import { describe, test, expect } from 'vitest'
import { encodeToBase64, decodeFromBase64 } from '../strings'

describe('utils/string-encoding', () => {
    test('encodeToBase64 encodes bytes correctly', () => {
        const bytes = new Uint8Array([80, 82, 73, 86, 75, 69, 89]) // 'PRIVKEY'
        expect(encodeToBase64(bytes)).toEqual('UFJJVktFWQ==')
    })

    test('decodeFromBase64 decodes base64 correctly', () => {
        const base64 = 'AQIDBAUG' // [1,2,3,4,5,6]
        const decoded = decodeFromBase64(base64)
        expect(Array.from(decoded)).toEqual([1, 2, 3, 4, 5, 6])
    })

    test('round-trip encode/decode returns original bytes', () => {
        const original = new Uint8Array([
            0, 1, 2, 3, 250, 251, 252, 253, 254, 255,
        ])
        const encoded = encodeToBase64(original)
        const decoded = decodeFromBase64(encoded)
        expect(Array.from(decoded)).toEqual(Array.from(original))
    })
})
