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

export const name = '@perawallet/wallet-extension-platform-driver'

export type {
    PlatformExtension,
    PlatformExtensionFn,
    PlatformServices,
} from '@perawallet/wallet-extension-platform'

import type {
    PlatformExtensionFn,
    PlatformServices,
} from '@perawallet/wallet-extension-platform'

const stubError = (): never => {
    throw new Error(
        'No platform driver configured. Configure your bundler to alias ' +
            '@perawallet/wallet-extension-platform-driver to a concrete platform extension.',
    )
}

/**
 * Stub platform extension that is replaced at build time by each app's bundler.
 *
 * Each app must alias `@perawallet/wallet-extension-platform-driver` to a concrete
 * platform extension package (e.g., `platform-react-native`, `platform-chrome`)
 * in its bundler configuration. If this stub is ever invoked at runtime, it means
 * the alias was not configured.
 */
export const WithPlatformExtension: PlatformExtensionFn = () => stubError()

/**
 * Returns the platform services singleton from the concrete platform extension.
 * Replaced at build time via bundler alias, just like `WithPlatformExtension`.
 */
export const getPlatformServices = (): PlatformServices => stubError()

/**
 * Async platform bootstrap (KV cache hydration on web; no-op on native).
 * Replaced at build time via bundler alias.
 */
export const hydratePlatform = (): Promise<void> => stubError()
