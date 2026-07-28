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

import { FALCON_1024_SCHEME } from 'algosdk'

/**
 * Post-quantum signature schemes this wallet can produce.
 *
 * The transaction wire format carries the scheme as a 2-byte identifier
 * alongside the public key and signature, so supporting a second PQ scheme is
 * a matter of adding an entry here — no new types and no new signing branch.
 * Keys are the scheme-agnostic ids used across the app; values are the wire
 * identifiers understood by the protocol ('f1' for Falcon-1024).
 */
export const PQ_SCHEMES = {
    falcon1024: FALCON_1024_SCHEME,
} as const

export type PQSchemeId = keyof typeof PQ_SCHEMES

export const DEFAULT_PQ_SCHEME_ID: PQSchemeId = 'falcon1024'
