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

// The kms subpath, not its barrel: this module is reachable from the
// service-worker payload gate, which must not pull the keystore graph.
import { SIGNING_ACCESS_DOMAIN } from '@perawallet/wallet-core-kms/constants'

export const MAX_TRANSACTION_SIGN_REQUESTS = 1000
export const MAX_DATA_SIGN_REQUESTS = 1000
export const SIGNING_KEY_DOMAIN = SIGNING_ACCESS_DOMAIN

/**
 * `decodeFromBase64` only rejects a length that is not a multiple of 4
 * (`'!!!!'` and `''` decode to garbage or empty bytes), so the alphabet and
 * padding are enforced here at the boundary. Both alphabets: base64-js decodes
 * `-`/`_` too, and a padded base64url `authenticatorData` — roughly four in
 * five random 37-byte payloads carry one of those characters — has always been
 * accepted, so a §4-only pattern would reject producers that work today.
 */
export const BASE64_PATTERN =
    /^(?:[A-Za-z0-9+/_-]{4})*(?:[A-Za-z0-9+/_-]{2}==|[A-Za-z0-9+/_-]{3}=|[A-Za-z0-9+/_-]{4})$/
