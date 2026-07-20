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

export type BrowserInfo = {
    /** Host browser name, e.g. "Chrome", "Firefox", "Edge". */
    name: string
    /** Host browser version, e.g. "125.0.6422.112". */
    version: string
    /** Best-effort operating system descriptor, e.g. "macOS", "Windows". */
    osVersion: string
}

type NavigatorUAData = {
    brands?: { brand: string; version: string }[]
    platform?: string
}

type NavigatorWithUAData = Navigator & { userAgentData?: NavigatorUAData }

const firstMatch = (ua: string, re: RegExp): string => ua.match(re)?.[1] ?? ''

// Chromium embeds "Chrome" and "Safari" tokens, Edge/Opera embed "Chrome", and
// Safari embeds "Safari" — so the more specific brands must be tested first.
const detectNameAndVersion = (
    ua: string,
): { name: string; version: string } => {
    if (/Firefox\//.test(ua)) {
        return { name: 'Firefox', version: firstMatch(ua, /Firefox\/([\d.]+)/) }
    }
    if (/Edg\//.test(ua)) {
        return { name: 'Edge', version: firstMatch(ua, /Edg\/([\d.]+)/) }
    }
    if (/OPR\//.test(ua)) {
        return { name: 'Opera', version: firstMatch(ua, /OPR\/([\d.]+)/) }
    }
    if (/Chrome\//.test(ua)) {
        return { name: 'Chrome', version: firstMatch(ua, /Chrome\/([\d.]+)/) }
    }
    if (/Safari\//.test(ua)) {
        return { name: 'Safari', version: firstMatch(ua, /Version\/([\d.]+)/) }
    }
    return { name: 'Browser', version: '' }
}

const detectOSVersion = (ua: string, platformHint?: string): string => {
    if (platformHint) return platformHint
    if (/Windows NT ([\d.]+)/.test(ua)) {
        return `Windows ${firstMatch(ua, /Windows NT ([\d.]+)/)}`
    }
    if (/Mac OS X ([\d_]+)/.test(ua)) {
        return `macOS ${firstMatch(ua, /Mac OS X ([\d_]+)/).replace(/_/g, '.')}`
    }
    if (/Android ([\d.]+)/.test(ua)) {
        return `Android ${firstMatch(ua, /Android ([\d.]+)/)}`
    }
    if (/(?:iPhone|iPad); CPU .*OS ([\d_]+)/.test(ua)) {
        return `iOS ${firstMatch(ua, /OS ([\d_]+)/).replace(/_/g, '.')}`
    }
    if (/Linux/.test(ua)) return 'Linux'
    return 'unknown'
}

let cached: BrowserInfo | undefined

/**
 * Resolves the host browser's name, version, and OS from the user-agent
 * string. The UA doesn't change over a page's lifetime, so the result is
 * memoized. Brave and other Chromium forks that spoof Chrome's UA report as
 * "Chrome" — synchronous UA parsing can't distinguish them.
 */
export const detectBrowser = (): BrowserInfo => {
    if (cached) return cached

    const nav =
        typeof navigator === 'undefined'
            ? undefined
            : (navigator as NavigatorWithUAData)
    const ua = nav?.userAgent ?? ''

    const { name, version } = detectNameAndVersion(ua)
    cached = {
        name: name || 'Browser',
        version,
        osVersion: detectOSVersion(ua, nav?.userAgentData?.platform),
    }
    return cached
}

/** Test-only: clears the memoized result so a new UA can be exercised. */
export const resetBrowserCache = (): void => {
    cached = undefined
}
