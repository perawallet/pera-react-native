/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, expect, test, vi } from 'vitest'

// `../constants` re-exports a couple of values from the signing barrel, which
// transitively loads `react-native-mmkv` (no native binding under vitest).
// Stub the barrel so importing constants/schema stays pure — mirrors the
// approach in the sibling WC handler/registry specs.
vi.mock('@perawallet/wallet-core-signing', () => ({
    MAX_DATA_SIGN_REQUESTS: 10,
    MAX_TRANSACTION_SIGN_REQUESTS: 10,
}))

import { ARC60_MAX_REQUEST_BYTES } from '../constants'
import { WalletConnectSignRequestError } from '../errors'
import { arc60PayloadSchema, assertArc60RequestWithinLimits } from '../schema'

const validPayload = {
    data: 'eyJ0ZXN0IjoxfQ==',
    signer: 'ABC123',
    domain: 'arc60.io',
    authenticatorData: 'AAAA',
    metadata: { scope: 1, encoding: 'base64' },
}

describe('assertArc60RequestWithinLimits', () => {
    test('accepts a request within the size cap', () => {
        expect(() => assertArc60RequestWithinLimits(validPayload)).not.toThrow()
    })

    test('rejects a request over the serialized size cap', () => {
        const oversized = { blob: 'x'.repeat(ARC60_MAX_REQUEST_BYTES) }
        expect(() => assertArc60RequestWithinLimits(oversized)).toThrow(
            WalletConnectSignRequestError,
        )
    })
})

describe('arc60PayloadSchema — field caps', () => {
    test('accepts a valid payload', () => {
        expect(arc60PayloadSchema.safeParse(validPayload).success).toBe(true)
    })

    test('rejects an over-cap data field', () => {
        const payload = { ...validPayload, data: 'x'.repeat(16 * 1024 + 1) }
        expect(arc60PayloadSchema.safeParse(payload).success).toBe(false)
    })

    test('rejects an over-cap signer', () => {
        const payload = { ...validPayload, signer: 'x'.repeat(129) }
        expect(arc60PayloadSchema.safeParse(payload).success).toBe(false)
    })

    test('rejects an over-cap domain', () => {
        const payload = { ...validPayload, domain: 'x'.repeat(257) }
        expect(arc60PayloadSchema.safeParse(payload).success).toBe(false)
    })

    test('rejects an over-cap authenticatorData', () => {
        const payload = {
            ...validPayload,
            authenticatorData: 'x'.repeat(513),
        }
        expect(arc60PayloadSchema.safeParse(payload).success).toBe(false)
    })

    test('rejects an over-cap metadata.encoding', () => {
        const payload = {
            ...validPayload,
            metadata: { scope: 1, encoding: 'x'.repeat(33) },
        }
        expect(arc60PayloadSchema.safeParse(payload).success).toBe(false)
    })
})
