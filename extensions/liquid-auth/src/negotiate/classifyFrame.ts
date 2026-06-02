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

import { NEGOTIATE_NAMESPACE } from './types'

export type FrameKind = 'negotiate-offer' | 'arc0027-request' | 'unknown'

/**
 * Classifies the first inbound frame.
 *
 * On the Liquid Auth data channel three frame shapes are disjoint by their
 * first character: negotiation frames are JSON objects (start with `{`),
 * ARC-0027 frames are base64(CBOR) text (never start with `{`), and heartbeats
 * are empty. So any non-empty frame that does not start with `{` is an opaque
 * ARC-0027 message.
 */
export const classifyFrame = (raw: string): FrameKind => {
    const trimmed = raw.trim()
    if (trimmed === '') return 'unknown' // heartbeat
    // ARC-0027 frames are base64(CBOR) text — opaque here and never JSON, so
    // any non-empty frame that isn't a JSON object is an ARC-0027 message.
    if (!trimmed.startsWith('{')) return 'arc0027-request'
    let parsed: unknown
    try {
        parsed = JSON.parse(trimmed)
    } catch {
        return 'unknown'
    }
    const reference = (parsed as { reference?: unknown }).reference
    if (typeof reference !== 'string') return 'unknown'
    const [namespace, method, type] = reference.split(':')
    if (
        namespace === NEGOTIATE_NAMESPACE &&
        method === 'negotiate' &&
        type === 'offer'
    ) {
        return 'negotiate-offer'
    }
    // A JSON frame is only ever a negotiation frame. (An arc0027 reference in
    // JSON is not a real wire frame — the CBOR route couldn't decode it — so
    // don't lock the dialect on one.)
    return 'unknown'
}
