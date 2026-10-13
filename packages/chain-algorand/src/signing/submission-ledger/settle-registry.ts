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

import type {
    SubmissionFlow,
    SubmissionSettledHandler,
} from '@perawallet/wallet-core-signing'

const handlers = new Map<SubmissionFlow, SubmissionSettledHandler>()

export const setSubmissionSettledHandler = (
    flow: SubmissionFlow,
    handler: SubmissionSettledHandler | null,
): void => {
    if (handler === null) {
        handlers.delete(flow)
    } else {
        handlers.set(flow, handler)
    }
}

export const getSubmissionSettledHandler = (
    flow: SubmissionFlow,
): SubmissionSettledHandler | null => handlers.get(flow) ?? null
