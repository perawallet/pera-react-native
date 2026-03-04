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

let instance: unknown = null

/**
 * Returns the provider singleton. Throws if called before `initializeProvider()`.
 * Use the generic parameter to cast to a provider type with extensions applied.
 */
export const getProvider = <T = unknown>(): T => {
    if (!instance) {
        throw new Error(
            'Provider not initialized. Call initializeProvider() during bootstrap.',
        )
    }
    return instance as T
}

/**
 * Sets the provider singleton. Must be called exactly once during app bootstrap.
 */
export const initializeProvider = (provider: unknown): void => {
    if (instance) {
        throw new Error('Provider already initialized.')
    }
    instance = provider
}

/**
 * Resets the provider singleton. Only for use in tests.
 */
export const resetProvider = (): void => {
    instance = null
}
