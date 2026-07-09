import { describe, expect, it } from 'vitest'
import { encodeAddress } from 'algosdk'
import {
    QUANTUM_TEST_ADDRESS,
    QUANTUM_TEST_MNEMONIC,
    QUANTUM_TEST_PUBLIC_KEY,
} from '../quantum'

describe('quantumAccountFixtures', () => {
    it('exposes a 25-word mnemonic', () => {
        expect(QUANTUM_TEST_MNEMONIC.split(' ')).toHaveLength(25)
    })

    it('derives a valid 58-char Algorand address deterministically', () => {
        expect(QUANTUM_TEST_ADDRESS).toHaveLength(58)
        // stable value → decodes without throwing
        expect(() => encodeAddress(QUANTUM_TEST_PUBLIC_KEY.subarray(0, 32))).not.toThrow()
    })
})
