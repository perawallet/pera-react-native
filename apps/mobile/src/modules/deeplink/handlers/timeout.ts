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

/**
 * Tag used to identify a timeout failure when handlers throw. The deeplink
 * error sheet checks for this so the user sees a "Took too long" message
 * instead of the raw underlying error.
 */
export const DEEPLINK_TIMEOUT_TAG = 'DEEPLINK_TIMEOUT'

export class DeeplinkTimeoutError extends Error {
    readonly tag = DEEPLINK_TIMEOUT_TAG
    constructor(
        public readonly stage: string,
        public readonly ms: number,
    ) {
        super(`Deeplink stage "${stage}" exceeded ${ms}ms`)
        this.name = 'DeeplinkTimeoutError'
    }
}
