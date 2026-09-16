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

import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'

const MASK_CHARACTERS = /[*x#•·]/i
const VISIBLE_DIGITS = 4
const MASK = '••••'

/**
 * Phone hint for the OTP step, never showing a full number.
 *
 * Baanx has not told us whether the login response masks `phoneNumber`, so this
 * handles both: an already-masked value is passed through untouched (masking it
 * twice would mangle it), and anything else is reduced to its last four digits.
 * Null when there is nothing worth showing, so the caller can fall back to copy
 * that does not name a destination.
 */
export const maskPhoneNumber = (
    phoneNumber: Maybe<string>,
): Nullable<string> => {
    const trimmed = phoneNumber?.trim()
    if (!trimmed) return null
    if (MASK_CHARACTERS.test(trimmed)) return trimmed

    const digits = trimmed.replace(/\D/g, '')
    // Too short to reveal a tail without effectively revealing the number.
    if (digits.length <= VISIBLE_DIGITS) return null

    return `${MASK}${digits.slice(-VISIBLE_DIGITS)}`
}
