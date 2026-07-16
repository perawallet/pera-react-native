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

import { PINNED_ROOT_SPKI_HASHES, SSL_PINNING_EXPIRATION_DATE } from './pins'

/** Per-domain options shape expected by react-native-ssl-public-key-pinning. */
export type DomainPinningOptions = {
    includeSubdomains: boolean
    publicKeyHashes: string[]
    expirationDate: string
}

export type PinningConfig = Record<string, DomainPinningOptions>

/**
 * Derives the SSL-pinning configuration from the backend/node URLs the build
 * is actually configured with.
 *
 * Exact hostnames are pinned (never wildcards — OkHttp and TrustKit disagree
 * on multi-label wildcard semantics), and only hosts under one of the
 * `allowedDomains` qualify: env-overridden dev URLs (localhost, custom nodes)
 * and third-party services must never be pinned. The suffix match is
 * label-anchored so lookalikes such as evil-perawallet.app do not qualify.
 *
 * Returns null when nothing is pinnable, so callers skip initialization
 * entirely.
 */
export const buildPinningConfig = (
    urls: readonly string[],
    allowedDomains: readonly string[],
): PinningConfig | null => {
    const config: PinningConfig = {}

    for (const url of urls) {
        let host: string
        try {
            host = new URL(url).hostname
        } catch {
            continue
        }
        const isPinnable = allowedDomains.some(
            domain => host === domain || host.endsWith(`.${domain}`),
        )
        if (!isPinnable) {
            continue
        }
        config[host] = {
            includeSubdomains: false,
            publicKeyHashes: [...PINNED_ROOT_SPKI_HASHES],
            expirationDate: SSL_PINNING_EXPIRATION_DATE,
        }
    }

    return Object.keys(config).length > 0 ? config : null
}
