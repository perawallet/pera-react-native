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
import type { AddressCodec } from '../contracts/address-codec'
import type { DeriveOpts, PaymentUriOpts } from '../models/domain'

export interface AddressCodecContractFixtures {
    publicKey: Uint8Array
    deriveOpts: DeriveOpts
    /** Spellings of one address that must compare equal, e.g. case or checksum variants. */
    equivalentSpellings?: readonly [string, string, ...string[]]
    invalid: readonly string[]
    /** A payment URI of another scheme, which the codec must decline. */
    foreignUri: string
    paymentUriOpts: PaymentUriOpts
}

/** Every chain package runs this against its own codec. */
export const addressCodecContractTests = (
    makeCodec: () => AddressCodec,
    fixtures: AddressCodecContractFixtures,
): void => {
    const derive = (codec: AddressCodec) =>
        codec.fromPublicKey(fixtures.publicKey, fixtures.deriveOpts)

    describe(`AddressCodec contract: ${makeCodec().chainId}`, () => {
        it('derives the same valid address from the same public key', () => {
            const codec = makeCodec()

            const address = derive(codec)

            expect(derive(codec)).toBe(address)
            expect(codec.isValid(address, fixtures.deriveOpts.networkId)).toBe(
                true,
            )
        })

        it('normalizes idempotently to a valid address', () => {
            const codec = makeCodec()
            const spellings = fixtures.equivalentSpellings ?? [derive(codec)]

            for (const spelling of spellings) {
                const normalized = codec.normalize(spelling)
                expect(codec.normalize(normalized)).toBe(normalized)
                expect(codec.isValid(normalized)).toBe(true)
            }
        })

        it('compares addresses reflexively and symmetrically', () => {
            const codec = makeCodec()
            const spellings = fixtures.equivalentSpellings ?? [derive(codec)]

            for (const a of spellings) {
                for (const b of spellings) {
                    expect(codec.areEqual(a, b)).toBe(true)
                    expect(codec.areEqual(b, a)).toBe(true)
                }
            }
        })

        it('rejects the empty string and every invalid fixture', () => {
            const codec = makeCodec()

            for (const address of ['', ...fixtures.invalid]) {
                expect(codec.isValid(address)).toBe(false)
            }
        })

        it('parses its own payment URI back to the same address and options', () => {
            const codec = makeCodec()
            const address = derive(codec)

            const parsed = codec.parsePaymentUri(
                codec.toPaymentUri(address, fixtures.paymentUriOpts),
            )

            expect(parsed).toBeDefined()
            const { address: parsedAddress, amount, ...rest } = parsed!
            const { amount: expectedAmount, ...expectedRest } =
                fixtures.paymentUriOpts
            expect(codec.areEqual(parsedAddress, address)).toBe(true)
            expect(amount?.toString()).toBe(expectedAmount?.toString())
            expect(rest).toEqual(expectedRest)
        })

        it('parses a bare payment URI to the address alone', () => {
            const codec = makeCodec()
            const address = derive(codec)

            const parsed = codec.parsePaymentUri(codec.toPaymentUri(address))

            expect(parsed && codec.areEqual(parsed.address, address)).toBe(true)
            expect(parsed?.amount).toBeUndefined()
        })

        it('declines a payment URI of another scheme', () => {
            expect(
                makeCodec().parsePaymentUri(fixtures.foreignUri),
            ).toBeUndefined()
        })
    })
}
