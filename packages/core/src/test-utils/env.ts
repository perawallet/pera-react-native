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

import { vi } from 'vitest'

export type EnvSnapshot = Record<string, string | undefined>

export const snapshotEnv = (): EnvSnapshot => {
    return { ...process.env }
}

export const restoreEnv = (snap: EnvSnapshot) => {
    process.env = { ...snap }
}

/**
 * Reset the ESM module cache before running a function that re-imports modules.
 * Useful when testing modules that evaluate process.env or singletons at import time.
 */
export const withFreshModules = async <T>(
    fn: () => Promise<T> | T,
): Promise<T> => {
    vi.resetModules()
    return await fn()
}
