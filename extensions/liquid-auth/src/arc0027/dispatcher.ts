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

import {
    ARC0027_ERROR_CODES,
    type Arc0027Method,
    type Arc0027RequestEnvelope,
} from './types'
import { Arc0027Error, toArc0027Error } from './errors'
import {
    buildErrorResponse,
    buildResponse,
    parseEnvelope,
    parseReference,
} from './codec'

export type Arc0027Handler = (
    envelope: Arc0027RequestEnvelope,
) => Promise<Record<string, unknown>>

export type Arc0027Handlers = Partial<Record<Arc0027Method, Arc0027Handler>>

/**
 * Builds the inbound-message handler bound to the data channel. Returns the
 * response string to send back, or null when the message needs no reply
 * (heartbeat, or a response-type frame the dApp shouldn't get echoed).
 */
export const createArc0027Dispatcher = (
    handlers: Arc0027Handlers,
): ((raw: string) => Promise<string | null>) => {
    return async (raw: string) => {
        if (!raw || raw.trim() === '') return null // heartbeat

        let envelope: Arc0027RequestEnvelope
        try {
            envelope = parseEnvelope(raw)
        } catch {
            return null
        }

        const { method, type } = parseReference(envelope.reference)
        if (type !== 'request') return null

        try {
            const handler = handlers[method]
            if (!handler) {
                throw new Arc0027Error(
                    ARC0027_ERROR_CODES.MethodNotSupportedError,
                    `Method not supported: ${method}`,
                )
            }
            const result = await handler(envelope)
            return buildResponse(envelope.id, method, result)
        } catch (error) {
            const arcError = toArc0027Error(error)
            return buildErrorResponse(envelope.id, method, arcError)
        }
    }
}
