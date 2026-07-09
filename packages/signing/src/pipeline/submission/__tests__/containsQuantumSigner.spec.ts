import { describe, expect, it } from 'vitest'
import { containsQuantumSigner } from '../containsQuantumSigner'
import type { SignerInfo } from '../../types'

describe('containsQuantumSigner', () => {
    it('returns true when any signer is quantum', () => {
        const signers: SignerInfo[] = [
            { address: 'A', accountType: 'algo25' },
            { address: 'B', accountType: 'quantum' },
        ]
        expect(containsQuantumSigner(signers)).toBe(true)
    })

    it('returns false when no signer is quantum', () => {
        const signers: SignerInfo[] = [{ address: 'A', accountType: 'algo25' }]
        expect(containsQuantumSigner(signers)).toBe(false)
    })

    it('returns false for signers with no accountType', () => {
        expect(containsQuantumSigner([{ address: 'A' }])).toBe(false)
    })
})
