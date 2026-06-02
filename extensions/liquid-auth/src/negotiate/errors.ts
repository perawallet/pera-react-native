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

import type { NegotiationErrorCode } from './types'

export class NegotiationError extends Error {
    readonly code: NegotiationErrorCode
    /** Extra payload surfaced in the error frame's `data` field. */
    readonly data?: unknown
    /**
     * The offer's `id`, when it was parseable. Present => the negotiator can
     * reply with an error frame keyed on it (e.g. 5002); absent => there is no
     * requestId to correlate a reply, so the negotiator closes silently.
     */
    readonly offerId?: string
    constructor(
        code: NegotiationErrorCode,
        message: string,
        data?: unknown,
        offerId?: string,
    ) {
        super(message)
        this.name = 'NegotiationError'
        this.code = code
        this.data = data
        this.offerId = offerId
    }
}
