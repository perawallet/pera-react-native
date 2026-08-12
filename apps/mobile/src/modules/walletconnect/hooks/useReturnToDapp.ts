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

import { useCallback } from 'react'
import { BackHandler, Linking, Platform } from 'react-native'
import { logger, stripUrlScheme } from '@perawallet/wallet-core-shared'

export type ReturnToDappArgs = {
    /** Browser name from the iOS @perawallet/connect wrapper's `browser=`
     * param (Bowser names like "Chrome", "Mobile Safari", plus "Brave" /
     * "DuckDuckGo" / "Opera GX" specials). */
    browserName?: string
    /** The dApp's https URL (peerMeta.url) — the only return target WC v1
     * metadata offers. */
    dappUrl?: string
}

export type UseReturnToDappResult = {
    canReturnToDapp: (args: ReturnToDappArgs) => boolean
    returnToDapp: (args: ReturnToDappArgs) => Promise<void>
}

const isHttpUrl = (value: string | undefined): value is string => {
    if (!value) return false
    try {
        const { protocol } = new URL(value)
        return protocol === 'https:' || protocol === 'http:'
    } catch {
        return false
    }
}

/**
 * Maps the initiating iOS browser to a URL-scheme link that reopens the
 * dApp's exact tab context where possible. Returns null when the right move
 * is opening the plain https URL instead (Safari, unknown browsers) — on
 * iOS 14+ that lands in the user's default browser.
 *
 * `Linking.openURL` needs no LSApplicationQueriesSchemes entry (only
 * `canOpenURL` does), and a scheme with no installed handler rejects, which
 * the caller catches and downgrades to the https fallback.
 */
export const buildIosBrowserReturnUrl = (
    browserName: string | undefined,
    dappUrl: string,
): string | null => {
    if (!browserName || !isHttpUrl(dappUrl)) return null
    const name = browserName.toLowerCase()
    const isSecure = dappUrl.startsWith('https:')
    // "scheme replaces protocol" style (Chrome/Edge/Opera Touch docs).
    const stripped = stripUrlScheme(dappUrl) ?? dappUrl
    const encoded = encodeURIComponent(dappUrl)

    if (name.includes('safari')) return null
    if (name.includes('chrome')) {
        return `${isSecure ? 'googlechromes' : 'googlechrome'}://${stripped}`
    }
    if (name.includes('firefox')) return `firefox://open-url?url=${encoded}`
    if (name.includes('brave')) return `brave://open-url?url=${encoded}`
    if (name.includes('edge')) {
        return `${isSecure ? 'microsoft-edge-https' : 'microsoft-edge-http'}://${stripped}`
    }
    if (name.includes('opera')) {
        return `${isSecure ? 'touch-https' : 'touch-http'}://${stripped}`
    }
    return null
}

/**
 * Sends the user back to the dApp after a WalletConnect action that arrived
 * via an OS deep link from a mobile browser.
 *
 * Android: the browser task that fired the wc: intent sits directly behind
 * ours, so exiting the activity reveals the exact tab, state intact —
 * no browser hint needed. iOS has no task-stack equivalent, so we deep-link
 * into the initiating browser (or the default browser as fallback).
 */
export const useReturnToDapp = (): UseReturnToDappResult => {
    const canReturnToDapp = useCallback((args: ReturnToDappArgs): boolean => {
        if (Platform.OS === 'android') return true
        // iOS has no task-stack return, so without the wrapper's browser
        // hint there is no browser to reopen — the system back-to-app
        // chevron covers that case.
        return !!args.browserName && isHttpUrl(args.dappUrl)
    }, [])

    const returnToDapp = useCallback(
        async ({ browserName, dappUrl }: ReturnToDappArgs): Promise<void> => {
            if (Platform.OS === 'android') {
                BackHandler.exitApp()
                return
            }
            if (!isHttpUrl(dappUrl)) return
            const schemeUrl = buildIosBrowserReturnUrl(browserName, dappUrl)
            if (schemeUrl) {
                try {
                    await Linking.openURL(schemeUrl)
                    return
                } catch {
                    // Browser not installed (or scheme drifted) — the plain
                    // https open below still gets the user to the dApp.
                }
            }
            try {
                await Linking.openURL(dappUrl)
            } catch (error) {
                logger.warn('[wc/return-to-dapp] failed to open dapp url', {
                    error,
                })
            }
        },
        [],
    )

    return { canReturnToDapp, returnToDapp }
}
