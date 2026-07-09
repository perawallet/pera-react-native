import { describe, expect, it } from 'vitest'
import { seedFromMnemonic } from 'algosdk'
import {
    deriveFalconAddressMock,
    deriveFalconKeypairMock,
} from '@perawallet/wallet-core-kms'
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
        // Arrange
        expect(QUANTUM_TEST_ADDRESS).toHaveLength(58)

        // Act / Assert: the exported address must match re-deriving from the exported pubkey
        expect(QUANTUM_TEST_ADDRESS).toBe(
            deriveFalconAddressMock(QUANTUM_TEST_PUBLIC_KEY),
        )
    })

    it('stays in sync with an end-to-end re-derivation from the mnemonic', () => {
        // Arrange
        const seed = seedFromMnemonic(QUANTUM_TEST_MNEMONIC)

        // Act
        const { publicKey } = deriveFalconKeypairMock(seed)

        // Assert
        expect(new Uint8Array(publicKey)).toEqual(
            new Uint8Array(QUANTUM_TEST_PUBLIC_KEY),
        )
        expect(deriveFalconAddressMock(publicKey)).toBe(QUANTUM_TEST_ADDRESS)
    })
})
