import { describe, expect, it } from 'vitest'
import { synthesizeQuantumTxid } from '../synthesizeQuantumSubmission'

describe('synthesizeQuantumTxid', () => {
    it('is deterministic for the same bytes', () => {
        const bytes = new Uint8Array([1, 2, 3, 4, 5])
        expect(synthesizeQuantumTxid(bytes)).toBe(synthesizeQuantumTxid(bytes))
    })

    it('produces a valid-looking 52-char base32 txid', () => {
        const txid = synthesizeQuantumTxid(new Uint8Array([9, 8, 7]))
        expect(txid).toMatch(/^[A-Z2-7]{52}$/)
    })

    it('is unique per payload', () => {
        expect(synthesizeQuantumTxid(new Uint8Array([1]))).not.toBe(
            synthesizeQuantumTxid(new Uint8Array([2])),
        )
    })
})
