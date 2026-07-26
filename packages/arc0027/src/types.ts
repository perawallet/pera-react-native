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

// Provenance: verbatim from packages/liquid-auth/src/arc0027/types.ts
// (branch wjbeau/liquidauth). Keep byte-identical; dedupe into one shared
// module when that branch merges. Wire-format-agnostic — the JSON browser
// codec (codec.ts) and the CBOR data-channel codec share these types.
export const ARC0027_NAMESPACE = 'arc0027'

export type Arc0027Method =
    | 'discover'
    | 'enable'
    | 'disable'
    | 'sign_transactions'
    | 'post_transactions'
    | 'sign_and_post_transactions'
    | 'sign_message'

export type Arc0027Reference = `${typeof ARC0027_NAMESPACE}:${Arc0027Method}:${
    | 'request'
    | 'response'}`

export type Arc0027RequestEnvelope = {
    id: string
    reference: Arc0027Reference
    params?: Record<string, unknown>
}

export type Arc0027ResponseEnvelope = {
    id: string
    reference: Arc0027Reference
    requestId: string
    result?: Record<string, unknown>
    error?: { code: number; message: string; data?: unknown }
}

export const ARC0027_ERROR_CODES = {
    UnknownError: 4000,
    MethodCanceledError: 4001,
    MethodTimedOutError: 4002,
    MethodNotSupportedError: 4003,
    NetworkNotSupportedError: 4004,
    UnauthorizedSignerError: 4100,
    InvalidInputError: 4200,
    InvalidGroupIdError: 4201,
    FailedToPostSomeTransactionsError: 4300,
} as const

export type Arc0027ErrorCode =
    (typeof ARC0027_ERROR_CODES)[keyof typeof ARC0027_ERROR_CODES]
