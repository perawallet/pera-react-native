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

/** The schemes the core derives and imports. Anything else is rejected at runtime. */
export type KmsKeyScheme = 'ed25519' | 'secp256k1'

/**
 * `scheme` is a wide `string` on purpose: the chain-facing port passes any
 * signing scheme, and method bivariance means a type check alone would let an
 * unsupported one through. The core's runtime guard is what rejects it.
 */
export type KmsDerivationRequest = {
    scheme: string
    path: string
    /** Caller-owned keystore id. The core never invents one, so existing ids stay stable. */
    id: string
    /** Backend knobs the chain owns (e.g. BIP32-Ed25519 `mode`, `metadata`), passed through unread. */
    params?: Record<string, unknown>
}

export type KmsImportRequest = {
    scheme: string
    /** Caller-owned keystore id. */
    id: string
    /** Seed to attach the imported key under; its ACL then governs the import. */
    parentKeyId?: string
}

export type KmsDerivedKey = {
    keyPairId: string
    publicKey: Uint8Array
}

export type Secp256k1DerivationRequest = Pick<
    KmsDerivationRequest,
    'path' | 'id'
>

export type Secp256k1ImportRequest = Pick<
    KmsImportRequest,
    'id' | 'parentKeyId'
>

/** `publicKey` is the 65-byte uncompressed SEC1 point. */
export type Secp256k1ChildRef = KmsDerivedKey
