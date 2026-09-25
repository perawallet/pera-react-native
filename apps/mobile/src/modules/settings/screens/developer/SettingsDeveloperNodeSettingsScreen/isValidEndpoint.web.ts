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

import { config } from '@perawallet/wallet-core-config'

// Mirrors the extension CSP's connect-src (apps/browser/scripts/csp.mjs), which
// blocks any other http: request, so a node saved here would silently fail.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1'])

export const isValidEndpoint = (value: string): boolean => {
    try {
        const { protocol, hostname } = new URL(value)
        if (protocol === 'https:') {
            return true
        }
        return (
            protocol === 'http:' &&
            LOOPBACK_HOSTS.has(hostname) &&
            config.appEnvironment !== 'production'
        )
    } catch {
        return false
    }
}

export const INVALID_ENDPOINT_MESSAGE_KEY =
    'settings.developer.node_settings.invalid_https_url'
