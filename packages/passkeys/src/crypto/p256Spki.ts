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

import { encodeToBase64 } from '@perawallet/wallet-core-shared'

/**
 * Split out from `derivePasskeyCredential.ts` so `packages/migrate` can import
 * these two pure helpers without also pulling in `react-native-quick-crypto`
 * (which `derivePasskeyMainKey` needs and which has no loadable build outside
 * a React Native runtime).
 */

/**
 * P-256 SPKI DER prefix through the BIT STRING header. Full SPKI = this 26-byte
 * prefix + `0x04` + the 64-byte `X || Y` = 91 bytes. `getPurePKBytes` returns
 * the raw point without `0x04`, so the indicator is spliced back in.
 */
const P256_SPKI_PREFIX = Uint8Array.from([
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03,
    0x42, 0x00,
])

export const p256RawPublicKeyToSpkiDer = (pubRaw: Uint8Array): Uint8Array => {
    const der = new Uint8Array(P256_SPKI_PREFIX.length + 1 + pubRaw.length)
    der.set(P256_SPKI_PREFIX, 0)
    der[P256_SPKI_PREFIX.length] = 0x04
    der.set(pubRaw, P256_SPKI_PREFIX.length + 1)
    return der
}

/** Standard-base64 with padding — the exact MMKV key the native provider's
 *  `getCredential` derives. */
export const credentialIdBytesToStandardBase64 = (bytes: Uint8Array): string =>
    encodeToBase64(bytes)
