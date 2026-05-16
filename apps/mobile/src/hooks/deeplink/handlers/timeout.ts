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

/**
 * Race a Promise against a timeout. Used to bound network-dependent work
 * inside deeplink handlers (algokit's createTransaction calls
 * `algod.suggestedParams()`; if algod is unreachable this can hang forever
 * with no visible feedback). Throwing surfaces a real error to the
 * dispatcher's catch, which then shows the deeplink error sheet.
 */
export const withTimeout = <T>(
    stage: string,
    ms: number,
    promise: Promise<T>,
): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            reject(new DeeplinkTimeoutError(stage, ms))
        }, ms)
    })
    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timer) clearTimeout(timer)
    })
}
