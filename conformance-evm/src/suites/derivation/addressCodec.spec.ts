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

import { describe, expect, it } from 'vitest'
import { createEvmAddressCodec } from '@perawallet/wallet-core-chain-ethereum/accounts/address-codec'
import { evmChainOf } from '@perawallet/wallet-core-chain-ethereum/chains/table'

import { castChecksumAddress } from '../../harness/cast'
import { EIP55_VECTORS } from '../../vectors/knownAnswerVectors'

const codec = createEvmAddressCodec(evmChainOf('ethereum'))

const flipFirstLetterCase = (address: string): string => {
    const body = address.slice(2)
    const at = body.search(/[a-fA-F]/)
    const letter = body[at]!
    const flipped =
        letter === letter.toLowerCase()
            ? letter.toUpperCase()
            : letter.toLowerCase()
    return `0x${body.slice(0, at)}${flipped}${body.slice(at + 1)}`
}

/**
 * Proves the address codec's EIP-55 handling against the spec's published
 * vectors and cast's independent checksum implementation.
 */
describe('evm address codec conformance', () => {
    it.each(EIP55_VECTORS)('normalises %s to itself', async vector => {
        expect(codec.isValid(vector)).toBe(true)
        expect(codec.normalize(vector)).toBe(vector)
        // Oracle parity: cast agrees the vector is canonical.
        expect(await castChecksumAddress(vector)).toBe(vector)
    })

    it.each(EIP55_VECTORS)('checksums lowercase %s to the vector', vector => {
        expect(codec.isValid(vector.toLowerCase())).toBe(true)
        expect(codec.normalize(vector.toLowerCase())).toBe(vector)
    })

    it('compares addresses case-insensitively', () => {
        const [vector] = EIP55_VECTORS as readonly [string]

        expect(codec.areEqual(vector, vector.toLowerCase())).toBe(true)
        expect(
            codec.areEqual(vector, `0x${vector.slice(2).toUpperCase()}`),
        ).toBe(true)
        expect(codec.areEqual(vector, EIP55_VECTORS[1]!)).toBe(false)
    })

    // normalize is lenient (it re-checksums any mixed-case input); isValid is
    // the typo gate and is strict, and every input surface checks isValid first.
    it('rejects a mixed-case address whose checksum is wrong via isValid', () => {
        const vector = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
        const typo = flipFirstLetterCase(vector)

        expect(typo).not.toBe(vector)
        expect(typo).not.toBe(typo.toLowerCase())
        expect(typo).not.toBe(`0x${typo.slice(2).toUpperCase()}`)
        expect(codec.isValid(typo)).toBe(false)
        expect(codec.normalize(typo)).toBe(vector)
    })

    it.each(['0x1234', 'not an address', ''])('rejects %j', input => {
        expect(codec.isValid(input)).toBe(false)
    })
})
