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
import type { Maybe } from './types'

/**
 * Extracts the HTTP status code from an error thrown by the ky HTTP client.
 * Returns undefined if the error is not an HTTP error or has no status.
 */
export const getHttpStatus = (error: unknown): number | undefined => {
    if (typeof error !== 'object' || error === null) return undefined
    const response = (error as { response?: { status?: unknown } }).response
    return typeof response?.status === 'number' ? response.status : undefined
}

/** Normalizes an unknown value to an Error instance. */
export const toError = (e: unknown): Error =>
    e instanceof Error ? e : new Error(String(e))

/** Asserts a value is non-null, throwing a descriptive error if it is. */
export function assertDefined<T>(value: Maybe<T>, name: string): T {
    if (value == null) {
        throw new Error(`expected ${name} to be defined`)
    }
    return value
}
