/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { decodeArc60Data } from './arc60'
import { type Siwa, parseSiwa } from './siwa'

export type Arc60ParsedPayload =
    | { type: 'siwa'; siwa: Siwa }
    | { type: 'error'; message: string }

/**
 * Decodes and parses an ARC-60 payload for human review.
 * Returns the parsed SIWA struct on success, or a typed error message
 * suitable for surfacing to the user — never throws.
 */
export const parseArc60ForDisplay = (
    data: string,
    encoding: string,
): Arc60ParsedPayload => {
    let bytes: Uint8Array
    try {
        bytes = decodeArc60Data(data, encoding)
    } catch (error) {
        return {
            type: 'error',
            message:
                error instanceof Error
                    ? error.message
                    : 'Failed to decode data',
        }
    }
    let jsonString: string
    try {
        jsonString = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
        return {
            type: 'error',
            message: 'Decoded payload is not valid UTF-8',
        }
    }
    try {
        return { type: 'siwa', siwa: parseSiwa(jsonString) }
    } catch (error) {
        return {
            type: 'error',
            message:
                error instanceof Error
                    ? error.message
                    : 'Failed to parse SIWA payload',
        }
    }
}
