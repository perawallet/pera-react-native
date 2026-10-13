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

import type { Nullable } from '@perawallet/wallet-core-shared'
import { BIOMETRIC_BLOB_VERSION } from './constants'

// The stored blob's framing has exactly one writer and one reader here, so a
// version change to it cannot half-land across the hook and the legacy
// migration that also has to produce a blob the reconcile will accept.

export const encodeBiometricBlob = (blob: string): Uint8Array => {
    const body = new TextEncoder().encode(blob)
    const framed = new Uint8Array(body.length + 1)
    framed[0] = BIOMETRIC_BLOB_VERSION
    framed.set(body, 1)
    return framed
}

// Null for anything this build does not understand, which the caller treats as
// a blob to be replaced rather than as a decryption failure.
export const decodeBiometricBlob = (bytes: Uint8Array): Nullable<string> => {
    if (bytes.length < 2 || bytes[0] !== BIOMETRIC_BLOB_VERSION) return null
    return new TextDecoder().decode(bytes.subarray(1))
}
