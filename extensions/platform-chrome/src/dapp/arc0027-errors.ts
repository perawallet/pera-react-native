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

// Provenance: verbatim from packages/liquid-auth/src/arc0027/errors.ts (wjbeau/liquidauth).
import { ARC0027_ERROR_CODES, type Arc0027ErrorCode } from './arc0027-types'

export class Arc0027Error extends Error {
    readonly code: Arc0027ErrorCode
    readonly data?: unknown
    constructor(code: Arc0027ErrorCode, message: string, data?: unknown) {
        super(message)
        this.name = 'Arc0027Error'
        this.code = code
        this.data = data
    }
}

/** Maps an arbitrary thrown value to an Arc0027Error (UnknownError fallback). */
export const toArc0027Error = (error: unknown): Arc0027Error => {
    if (error instanceof Arc0027Error) return error
    const message = error instanceof Error ? error.message : String(error)
    return new Arc0027Error(ARC0027_ERROR_CODES.UnknownError, message)
}
