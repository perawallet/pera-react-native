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

import {
    InvalidBip44PathError,
    type HDWalletDetails,
} from '@perawallet/wallet-core-accounts'

/**
 * Algorand's SLIP-0044 coin type. Used as the second segment of BIP44 paths
 * for all Algorand HD wallet derivations.
 */
export const ALGORAND_COIN_TYPE = 283

/**
 * Structured form of an Algorand BIP44 path
 * `m/44'/283'/<account>'/<change>/<keyIndex>`.
 */
export type ParsedAlgorandBip44Path = {
    account: number
    change: number
    keyIndex: number
}

/**
 * Parses an Algorand BIP44 path `m/44'/283'/<account>'/<change>/<keyIndex>`.
 *
 * Accepts both `m/44'/...` and `44'/...` forms. The hardened marker may be
 * either `'` (apostrophe) or `h`.
 *
 * Throws {@link InvalidBip44PathError} with `reason: 'malformed'` if the path
 * is not a well-formed Algorand BIP44 path.
 */
export const parseAlgorandBip44Path = (
    hdPath: string,
): ParsedAlgorandBip44Path => {
    const fail = (detail: string): never => {
        throw new InvalidBip44PathError(hdPath, 'malformed', detail)
    }

    const segments = hdPath
        .replace(/^m\//, '')
        .split('/')
        .map(s => s.trim())
        .filter(Boolean)

    if (segments.length !== 5) {
        return fail('expected 5 path segments')
    }

    const parseHardened = (segment: string, label: string): number => {
        if (!segment.endsWith("'") && !segment.endsWith('h')) {
            return fail(`${label} must be hardened`)
        }
        const value = Number(segment.slice(0, -1))
        if (!Number.isInteger(value) || value < 0) {
            return fail(`${label} is not a valid integer`)
        }
        return value
    }

    const parseUnhardened = (segment: string, label: string): number => {
        const value = Number(segment)
        if (!Number.isInteger(value) || value < 0) {
            return fail(`${label} is not a valid integer`)
        }
        return value
    }

    const purpose = parseHardened(segments[0], 'purpose')
    const coin = parseHardened(segments[1], 'coin type')
    const account = parseHardened(segments[2], 'account')
    const change = parseUnhardened(segments[3], 'change')
    const keyIndex = parseUnhardened(segments[4], 'keyIndex')

    if (purpose !== 44) {
        return fail(`purpose must be 44, got ${purpose}`)
    }
    if (coin !== ALGORAND_COIN_TYPE) {
        return fail(`coin type must be ${ALGORAND_COIN_TYPE}, got ${coin}`)
    }

    return { account, change, keyIndex }
}

/**
 * Returns `true` when `path` resolves to the same BIP44 coordinates as the
 * given HD wallet details. Throws {@link InvalidBip44PathError} (with
 * `reason: 'malformed'`) if the path is not parseable — malformed is a
 * distinct failure mode from mismatch and callers typically want to surface
 * different errors to the user.
 */
export const hdPathMatchesDetails = (
    path: string,
    details: HDWalletDetails,
): boolean => {
    const parsed = parseAlgorandBip44Path(path)
    return (
        parsed.account === details.account &&
        parsed.change === details.change &&
        parsed.keyIndex === details.keyIndex
    )
}

/**
 * Asserts that `path` resolves to the same BIP44 coordinates as the given
 * HD wallet details. Throws {@link InvalidBip44PathError}:
 *
 * - `reason: 'malformed'` — path cannot be parsed
 * - `reason: 'mismatch'` — path parses but targets a different derivation
 *
 * Callers that need a domain-specific error should catch and rewrap using
 * the `reason` field.
 */
export const assertAlgorandBip44PathMatches = (
    path: string,
    details: HDWalletDetails,
): void => {
    const parsed = parseAlgorandBip44Path(path)
    if (
        parsed.account !== details.account ||
        parsed.change !== details.change ||
        parsed.keyIndex !== details.keyIndex
    ) {
        throw new InvalidBip44PathError(
            path,
            'mismatch',
            `does not match HD wallet (account=${details.account}, change=${details.change}, keyIndex=${details.keyIndex})`,
        )
    }
}
