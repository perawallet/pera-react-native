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
import type { Maybe, Optional } from '@perawallet/wallet-core-shared'
import type { SiteHost } from './models'

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/
const ASCII_HOST = /^[a-z0-9_.-]+$/

// A scan, not `/\.+$/`: the input is dApp-supplied, and that regex backtracks
// quadratically on a long run of dots that isn't at the end.
const withoutTrailingDots = (value: string): string => {
    let end = value.length
    while (end > 0 && value[end - 1] === '.') end--
    return value.slice(0, end)
}

/**
 * Both forms of a URL's host. The punycode conversion is done here because
 * React Native's URL polyfill does no IDNA. IP literals, `localhost` and other
 * single-label hosts give `undefined`: no list or look-alike rule covers them.
 */
export const toSiteHost = (url: Maybe<string>): Optional<SiteHost> => {
    if (!url) return undefined
    const withoutScheme = url.trim().replace(SCHEME, '')
    const authority = withoutScheme.split(/[/?#]/)[0] ?? ''
    const hostAndPort = authority.split('@').pop() ?? ''
    if (hostAndPort.startsWith('[')) return undefined
    const host = withoutTrailingDots(
        (hostAndPort.split(':')[0] ?? '').toLowerCase(),
    )
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

// Suffixes under which anyone can claim a name, so the label left of them is
// the site's own: free hosting (the usual home of a phishing page) and
// common second-level country domains. Anything else is read as a one-label TLD.
const MULTI_LABEL_SUFFIXES: ReadonlySet<string> = new Set([
    'amplifyapp.com',
    'azurewebsites.net',
    'blogspot.com',
    'cloudfront.net',
    'duckdns.org',
    'firebaseapp.com',
    'fly.dev',
    'framer.app',
    'framer.website',
    'github.io',
    'gitlab.io',
    'glitch.me',
    'herokuapp.com',
    'netlify.app',
    'ngrok-free.app',
    'ngrok.io',
    'on.fleek.co',
    'onrender.com',
    'pages.dev',
    'r2.dev',
    'replit.app',
    'square.site',
    'surge.sh',
    'vercel.app',
    'web.app',
    'webflow.io',
    'weebly.com',
    'wixsite.com',
    'workers.dev',
    'ac.uk',
    'co.uk',
    'org.uk',
    'co.jp',
    'co.kr',
    'co.in',
    'co.nz',
    'co.za',
    'com.ar',
    'com.au',
    'net.au',
    'org.au',
    'com.br',
    'net.br',
    'com.cn',
    'com.hk',
    'com.mx',
    'com.sg',
    'com.tr',
    'com.tw',
])

const MAX_SUFFIX_LABELS = 3

/** How many trailing labels form the host's public suffix: 1 for `.org`, 2 for `.vercel.app`. */
export const publicSuffixLabelCount = (asciiHost: string): number => {
    const labels = asciiHost.split('.')
    for (let count = MAX_SUFFIX_LABELS; count >= 2; count--) {
        if (
            labels.length > count &&
            MULTI_LABEL_SUFFIXES.has(labels.slice(-count).join('.'))
        ) {
            return count
        }
    }
    return 1
}

/** The public suffix plus one label: `uniswap.org`, `claim.vercel.app`, `uniswap.co.uk`. */
export const registrableDomainOf = (asciiHost: string): string =>
    asciiHost
        .split('.')
        .slice(-(publicSuffixLabelCount(asciiHost) + 1))
        .join('.')
