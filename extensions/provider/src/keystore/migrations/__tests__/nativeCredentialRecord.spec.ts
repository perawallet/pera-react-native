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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sealNativeCredentialRecord } from '../nativeCredentialRecord'

/**
 * `nativeCredentialRecord.ts` restates
 * `packages/passkeys/src/native/nativeProviderRecord.ts`'s seal function
 * rather than importing it — that module's doc explains why (`packages/passkeys`
 * already depends on `@perawallet/wallet-extension-provider`, so the reverse
 * import would be circular). A **test-only** import of just the reader half
 * doesn't create that runtime cycle, but adding `@perawallet/wallet-core-passkeys`
 * as an `extensions/provider` devDependency still trips turbo's whole-graph
 * cycle check (`pnpm build` fails with "Cyclic dependency detected" even
 * though the two packages' own `build` scripts ran clean side by side) — and a
 * full `pnpm build` is this repo's own completion gate, so that path is closed.
 *
 * The fallback the round-3 review allows: pin against a literal golden
 * envelope. `GOLDEN_ENVELOPE` below was captured *once*, offline, by
 * temporarily adding that devDependency, sealing `RECORD` under a
 * deterministic IV with this module's real `sealNativeCredentialRecord`, and
 * opening the result with the real `openNativeProviderRecord` from
 * `@perawallet/wallet-core-passkeys/native` — confirmed to decode back to
 * `RECORD` byte-for-byte, including the non-ASCII `userHandle` (the UTF-8 fix
 * this round made reachable). This test only proves this module's writer
 * hasn't drifted from that captured-good envelope since; it cannot catch a
 * *new* divergence introduced on the other side of the cycle. Re-capture
 * `GOLDEN_ENVELOPE` (same steps) if `sealNativeCredentialRecord`'s wire format
 * ever changes on purpose.
 */
describe('nativeCredentialRecord matches the real provider reader (golden envelope)', () => {
    const subtle = globalThis.crypto.subtle
    const masterKey = new Uint8Array(32).fill(9)

    const RECORD = {
        id: 'cred-1',
        type: 'hd-derived-p256',
        publicKey: Array.from(new Uint8Array(91).fill(4)),
        privateKey: Array.from(new Uint8Array(32).fill(3)),
        metadata: { origin: 'https://webauthn.io', userHandle: 'ünïcode' },
    }

    const GOLDEN_ENVELOPE =
        '{"iv":"AQEBAQEBAQEBAQEB","tag":"gEWttvcETpkGARM0RKEG1g==","content":"3AnLFUmkgUZYIxG0v9jRZ/GWjbmsri/1j/Rc/WOoEr1pOzc9fICn8AJVB4/n4s4c2GNxV/HKH0qIwqm6EwYIkIM26dfcYN7NJxWGOLFL2g6wTwybD0ziNuP2ZoUu8LY3r5V/qjcwRefnPCW9EhwU6+L42A3s8CPynF7bkCGZh4YLvKH03Sjsn3WJz/LsnCboH71krASfx2Y+DIc6jPeS9RjqvYgcxu61Pp8yLUJ70vuPCKdx+2y6GmzflBOtcxX8WTp4TGhE5sv4zskvnceAyXwfIELoE4B9CtwGipX1oQ5Q20uCBBivsAvF8oHxjSnlVCeFam/CmDDBV7QIqT106mD9ijW/ICmJHM3DtRz0DLDqubJAIs2W6MQOwcGge92keqCmqKmUV3/mbgsCHyK86iHu8ArwLH3WnEs1E8XDaZvZhCENbQDCrQDRVIxZtDlgGl52RY1pLU4gzcKcDVz5A5jdWwbUke+yAt9plO8ki0D3xsg9Hh5CzFU1aWNBE8iVci7xcOCMMa4mrOT+gBaDVt9+ebNBHyOn7+XLgK0a0IS+P8//vfgqRGoulcgdw8oFZsz6uNBhHeSJ6+e9CrMUaqaFptXhW/slCsgwp2aehF7ndEKmjuCUKB+S07/+Z/Xe2kmaDETwQyyMMDhpTYKWBcAEUqmbiWr28Mlg82USvE8="}'

    beforeEach(() => {
        vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => {
            ;(array as Uint8Array).set(new Uint8Array(12).fill(1))
            return array as never
        })
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('seals RECORD to exactly the envelope the real openNativeProviderRecord was confirmed to open', async () => {
        const sealed = await sealNativeCredentialRecord(
            subtle,
            masterKey,
            RECORD,
        )

        expect(sealed).toBe(GOLDEN_ENVELOPE)
    })
})
