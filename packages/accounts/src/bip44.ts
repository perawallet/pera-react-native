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

import { InvalidBip44PathError } from './errors'
import type { HDWalletDetails } from './models'

export type Bip44Coordinates = Pick<
    HDWalletDetails,
    'account' | 'change' | 'keyIndex'
>

/**
 * Parses `m/44'/<coinType>'/<account>'/<change>/<keyIndex>`. `m/` is optional
 * and `h` may stand for `'`. Throws {@link InvalidBip44PathError}
 * (`reason: 'malformed'`) for anything else.
 */
export const parseBip44Path = (
    hdPath: string,
    coinType: number,
): Bip44Coordinates => {
    const fail = (detail: string): never => {
        throw new InvalidBip44PathError(hdPath, 'malformed', detail)
    }

    const segments = hdPath
        .trim()
        .replace(/^m\//, '')
        .split('/')
        .map(s => s.trim())

    if (segments.length !== 5) {
        return fail('expected 5 path segments')
    }

    const parseIndex = (
        segment: string,
        label: string,
        isHardened: boolean,
    ): number => {
        const hardenedMarker = /['h]$/.test(segment)
        if (hardenedMarker !== isHardened) {
            return fail(`${label} must ${isHardened ? '' : 'not '}be hardened`)
        }
        const digits = isHardened ? segment.slice(0, -1) : segment
        if (!/^\d+$/.test(digits)) {
            return fail(`${label} is not a valid integer`)
        }
        return Number(digits)
    }

    const purpose = parseIndex(segments[0], 'purpose', true)
    const coin = parseIndex(segments[1], 'coin type', true)
    const account = parseIndex(segments[2], 'account', true)
    const change = parseIndex(segments[3], 'change', false)
    const keyIndex = parseIndex(segments[4], 'keyIndex', false)

    if (purpose !== 44) {
        return fail(`purpose must be 44, got ${purpose}`)
    }
    if (coin !== coinType) {
        return fail(`coin type must be ${coinType}, got ${coin}`)
    }

    return { account, change, keyIndex }
}

/** Throws {@link InvalidBip44PathError}: `'malformed'` when unparseable, `'mismatch'` when it names other coordinates. */
export const assertBip44PathMatches = (
    hdPath: string,
    details: HDWalletDetails,
    coinType: number,
): void => {
    const parsed = parseBip44Path(hdPath, coinType)
    if (
        parsed.account !== details.account ||
        parsed.change !== details.change ||
        parsed.keyIndex !== details.keyIndex
    ) {
        throw new InvalidBip44PathError(
            hdPath,
            'mismatch',
            `does not match HD wallet (account=${details.account}, change=${details.change}, keyIndex=${details.keyIndex})`,
        )
    }
}
