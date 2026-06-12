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

// The canonical ARC-60 wire schema + size cap now live in the signing package
// (and are unit-tested there: utils/__tests__/arc60-wire.spec.ts). WC only
// re-exports the schema and re-wraps the size-cap error into a
// `WalletConnectSignRequestError`, so this spec covers that wrapper contract.
//
// The barrel is mocked because importing it for real transitively loads
// `react-native-mmkv` (no native binding under vitest) — mirrors the sibling
// WC handler/registry specs. The factory is hoisted, so the cap is inlined
// rather than referencing a top-level constant.
vi.mock('@perawallet/wallet-core-signing', () => ({
    MAX_DATA_SIGN_REQUESTS: 10,
    MAX_TRANSACTION_SIGN_REQUESTS: 10,
    ARC60_MAX_REQUEST_BYTES: 64 * 1024,
    arc60WireSchema: {
        safeParse: (value: unknown) => ({ success: true, data: value }),
    },
    assertArc60RequestWithinLimits: (rawParams: unknown) => {
        if ((JSON.stringify(rawParams) ?? '').length > 64 * 1024) {
            throw new Error('request exceeds the maximum allowed size')
        }
    },
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

    test('re-wraps the shared size-cap error as a WalletConnectSignRequestError', () => {
        const oversized = { blob: 'x'.repeat(ARC60_MAX_REQUEST_BYTES) }
        expect(() => assertArc60RequestWithinLimits(oversized)).toThrow(
            WalletConnectSignRequestError,
        )
        expect(() => assertArc60RequestWithinLimits(oversized)).toThrow(
            /Invalid ARC-60 sign request payload/,
        )
    })
})

describe('arc60PayloadSchema', () => {
    test('re-exports the shared signing wire schema', () => {
        expect(arc60PayloadSchema.safeParse(validPayload).success).toBe(true)
    })
})
