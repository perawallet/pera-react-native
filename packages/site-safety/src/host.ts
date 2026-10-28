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

// Bundlers resolve this to the npm package; under Node (tests, the snapshot
// script) the deprecated built-in of the same name answers instead.
import { toASCII, toUnicode } from 'punycode'
import type { SiteHost } from './models'

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/
const ASCII_HOST = /^[a-z0-9_.-]+$/

/**
 * Both forms of a URL's host. The punycode conversion is done here because
 * React Native's URL polyfill does no IDNA. IP literals, `localhost` and other
 * single-label hosts give `undefined`: no list or look-alike rule covers them.
 */
export const toSiteHost = (
    url: string | null | undefined,
): SiteHost | undefined => {
    if (!url) return undefined
    const withoutScheme = url.trim().replace(SCHEME, '')
    const authority = withoutScheme.split(/[/?#]/)[0] ?? ''
    const hostAndPort = authority.split('@').pop() ?? ''
    if (hostAndPort.startsWith('[')) return undefined
    const host = (hostAndPort.split(':')[0] ?? '')
        .toLowerCase()
        .replace(/\.+$/, '')
    if (!host.includes('.') || IPV4.test(host)) return undefined

    try {
        const ascii = toASCII(host)
        if (!ASCII_HOST.test(ascii)) return undefined
        return { ascii, unicode: toUnicode(ascii) }
    } catch {
        return undefined
    }
}

/** The host and each parent domain down to two labels, most specific first. */
export const listLookupCandidates = (asciiHost: string): string[] => {
    const labels = asciiHost.split('.')
    const candidates: string[] = []
    for (let i = 0; i <= labels.length - 2; i++) {
        candidates.push(labels.slice(i).join('.'))
    }
    return candidates
}

export const isWithinDomain = (asciiHost: string, domain: string): boolean =>
    asciiHost === domain || asciiHost.endsWith(`.${domain}`)
