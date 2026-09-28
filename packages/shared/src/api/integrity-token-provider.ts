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

type IntegrityTokenProvider = () => string | null

let provider: IntegrityTokenProvider | null = null

/**
 * Inverts the dependency: `setStandardHeaders` needs the app-integrity token,
 * but `@perawallet/wallet-core-app-integrity` already depends on this package,
 * so it registers its getter here instead. Each realm's bootstrap calls this
 * once — the service worker and the web UI have separate module instances.
 */
export const setIntegrityTokenProvider = (
    next: IntegrityTokenProvider,
): void => {
    provider = next
}

export const readIntegrityToken = (): string | null => {
    try {
        return provider?.() ?? null
    } catch {
        return null
    }
}
