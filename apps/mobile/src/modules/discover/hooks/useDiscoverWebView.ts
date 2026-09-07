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
import { logger } from '@perawallet/wallet-core-shared'
import { useNeedsMigration } from '@perawallet/wallet-core-migrate'
import { isSafeRelativePath } from '@modules/webview/hooks/handlers'

const joinDiscoverPath = (baseUrl: string, path?: string): string => {
    if (!path) return baseUrl
    if (!isSafeRelativePath(path)) {
        logger.warn('Discover webview: ignoring unsafe path param', { path })
        return baseUrl
    }
    const normalizedBase = baseUrl.endsWith('/')
        ? baseUrl.slice(0, -1)
        : baseUrl
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${normalizedBase}${normalizedPath}`
}

export type UseDiscoverWebViewResult = {
    url: string
    isReady: boolean
}

export const useDiscoverWebView = (path?: string): UseDiscoverWebViewResult => {
    const { isChecking, needsMigration } = useNeedsMigration()

    // hold the Discover WebView until the migration gate settles.
    // The Discover web app reads the device id once on load; loading it before
    // the migrated device id is written would fetch favorites with no id and
    // never retry. Gating on migration completion (not device-id presence)
    // avoids blocking users who legitimately have no id.
    const isReady = !(isChecking || needsMigration)
    const url = joinDiscoverPath(config.discoverBaseUrl, path)

    return { url, isReady }
}
