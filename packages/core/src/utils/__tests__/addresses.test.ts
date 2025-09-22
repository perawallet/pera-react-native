import { describe, test, expect, vi, afterEach } from 'vitest'
import { truncateAlgorandAddress } from '../addresses'

afterEach(() => {
    vi.restoreAllMocks()
})

describe('utils/addresses - truncateAlgorandAddress', () => {
    test('returns original when length <= 11', () => {
        expect(truncateAlgorandAddress('SHORT')).toEqual('SHORT')
        expect(truncateAlgorandAddress('ABCDEFGHIJK')).toEqual('ABCDEFGHIJK')
    })

    test('truncates when length > 11 (5+...+5)', () => {
        expect(truncateAlgorandAddress('ABCDEFGHIJKL')).toEqual('ABCDE...HIJKL')
        expect(truncateAlgorandAddress('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toEqual(
            'ABCDE...VWXYZ',
        )
    })
})
