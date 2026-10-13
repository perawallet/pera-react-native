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

import { assertType, expectTypeOf, it } from 'vitest'
import type { ChainKeyStore } from '@perawallet/wallet-core-chain-contract'
import {
    personalMessageDigest,
    transactionDigest,
    typedDataDigest,
} from '../digests'
import type { TaggedDigest } from '../digests'
import { signTagged } from '../sign'
import type { AuthContext } from '../sign'

declare const kms: Pick<ChainKeyStore, 'sign'>

it('accepts only a TaggedDigest as the signed input', () => {
    expectTypeOf(signTagged).parameter(2).toEqualTypeOf<TaggedDigest>()
    expectTypeOf<Uint8Array>().not.toExtend<TaggedDigest>()
    expectTypeOf<{
        tag: 'eip155-tx'
        digest: Uint8Array
    }>().not.toExtend<TaggedDigest>()

    // @ts-expect-error a raw 32-byte hash is eth_sign's payload
    void signTagged(kms, 'id', new Uint8Array(32))
    // @ts-expect-error a hand-built digest lacks the brand
    assertType<TaggedDigest>({ tag: 'eip155-tx', digest: new Uint8Array(32) })
})

it('mints a TaggedDigest from each hasher', () => {
    expectTypeOf(transactionDigest).returns.toEqualTypeOf<TaggedDigest>()
    expectTypeOf(personalMessageDigest).returns.toEqualTypeOf<TaggedDigest>()
    expectTypeOf(typedDataDigest).returns.toEqualTypeOf<TaggedDigest>()
})

it('takes an optional auth context', () => {
    expectTypeOf(signTagged)
        .parameter(3)
        .toEqualTypeOf<AuthContext | undefined>()
})
