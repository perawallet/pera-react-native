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

// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import {
    createDefaultShims,
    createDP256Binding,
    consumeKeyMaterial,
    DP256_ALGORITHM,
} from '@algorandfoundation/keystore-core'

/**
 * Pins the two things that decide how the passkey main key is derived, both of
 * which `createPeraKeystore` gets by supplying no `shims` and no `dp256`
 * override.
 *
 * `createDefaultShims` wraps the bundled dp256 binding in
 * `withSubtleDerivedMainKey` **only when no `dp256` override is passed**
 * (`keystore-core@1.0.0-canary.3` `dist/defaults.js:169`), and the React Native
 * engine calls it that way (`react-native-keystore@1.0.0-canary.19`
 * `dist/engine.js:205-209`, which passes `{ falcon }` alone). Supplying a
 * `dp256` override would silently swap the host's native PBKDF2 for the
 * bundled pure-JS one — 210,000 `@noble/hashes` iterations, which blocks
 * Hermes.
 *
 * Both paths produce identical bytes, so a bytes-only assertion cannot tell
 * them apart; the host-call assertion below is the one that discriminates.
 */

// The fallback case really does run 210,000 pure-JS PBKDF2 iterations — that
// slowness is the defect being pinned, not an accident — so it costs ~1.4s idle
// and over 13s when the full monorepo suite saturates the CPU. Raised here
// rather than made faster: a faster derivation would stop demonstrating the
// cost that makes the override wrong on Hermes.
vi.setConfig({ testTimeout: 30_000 })

/** 32 bytes of 0x09 — arbitrary, fixed so the vector below stays reproducible. */
const ENTROPY = new Uint8Array(32).fill(9)

/**
 * PBKDF2-HMAC-SHA512(ENTROPY, salt `"liquid"`, 210,000 iterations, 64 bytes).
 * Drift in any of those four parameters changes every passkey the wallet will
 * ever derive, and only a stored vector catches a change made consistently on
 * both sides.
 */
const MAIN_KEY_VECTOR =
    'b9d6c2d18b7f443484800fe7e1e44e92a6e224f5f7d83d8f6c7f77927a8dfc1d' +
    '99d2c41aefaa76fe38adb1ee58db001daf99d2075b559d15eb6a7015f805d178'

const toHex = (bytes: Uint8Array): string =>
    Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')

type DeriveBitsCall = {
    name?: string
    hash?: string
    iterations?: number
    salt?: BufferSource
}

/** Records what the host Subtle was asked to derive, then delegates to it. */
const recordingHost = () => {
    const deriveBitsCalls: DeriveBitsCall[] = []
    const real = globalThis.crypto.subtle

    const host = {
        ...({} as SubtleCrypto),
        importKey: real.importKey.bind(real),
        deriveBits: (
            algorithm: AlgorithmIdentifier | Algorithm,
            baseKey: CryptoKey,
            length: number,
        ) => {
            deriveBitsCalls.push(algorithm as DeriveBitsCall)
            return real.deriveBits(
                algorithm as AlgorithmIdentifier,
                baseKey,
                length,
            )
        },
    } as unknown as SubtleCrypto

    return { host, deriveBitsCalls }
}

const mintMainKey = async (
    overrides: Parameters<typeof createDefaultShims>[0],
) => {
    const { host, deriveBitsCalls } = recordingHost()
    const shims = await createDefaultShims(overrides)
    const dp256Shim = shims.find(shim => shim.algorithm === DP256_ALGORITHM)
    if (!dp256Shim) throw new Error('default shims carry no dp256 shim')

    const handle = await dp256Shim(host).generateKey(
        {
            name: DP256_ALGORITHM,
            entropy: Uint8Array.from(ENTROPY),
        } as unknown as AlgorithmIdentifier,
        false,
        ['sign'],
    )

    return {
        bytes: consumeKeyMaterial(handle as unknown as CryptoKey, material =>
            Uint8Array.from(material),
        ),
        pbkdf2Calls: deriveBitsCalls.filter(call => call.name === 'PBKDF2'),
    }
}

describe('passkey main-key derivation', () => {
    it('derives the main key through the host Subtle when no dp256 override is supplied', async () => {
        // `{ falcon: undefined }` mirrors `engine.js`'s call exactly: the RN
        // engine always passes a `falcon` slot and never a `dp256` one.
        const { bytes, pbkdf2Calls } = await mintMainKey({ falcon: undefined })

        expect(pbkdf2Calls).toHaveLength(1)
        expect(pbkdf2Calls[0]).toMatchObject({
            name: 'PBKDF2',
            hash: 'SHA-512',
            iterations: 210_000,
        })
        expect(
            new TextDecoder().decode(pbkdf2Calls[0]?.salt as Uint8Array),
        ).toBe('liquid')
        expect(bytes).toHaveLength(64)
        expect(toHex(bytes)).toBe(MAIN_KEY_VECTOR)
    })

    // The regression this file exists for: an explicit `dp256` override is
    // taken as-is, so the derivation silently moves off the host.
    it('falls back to the bundled pure-JS derivation when a dp256 override is supplied', async () => {
        const { bytes, pbkdf2Calls } = await mintMainKey({
            falcon: undefined,
            dp256: await createDP256Binding(),
        })

        expect(pbkdf2Calls).toHaveLength(0)
        // Identical bytes either way — which is exactly why the call count,
        // not the vector, is what pins the host path above.
        expect(toHex(bytes)).toBe(MAIN_KEY_VECTOR)
    })
})
