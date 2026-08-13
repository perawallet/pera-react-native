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
import { logger } from '@perawallet/wallet-core-shared'

export type ReturnToDappArgs = {
    /** Browser name from the iOS @perawallet/connect wrapper's `browser=`
     * param (Bowser names like "Chrome", "Mobile Safari", plus "Brave" /
     * "DuckDuckGo" / "Opera GX" specials). */
    browserName?: string
}

export type UseReturnToDappResult = {
    canReturnToDapp: (args: ReturnToDappArgs) => boolean
    returnToDapp: (args: ReturnToDappArgs) => Promise<void>
}

/**
 * Maps the initiating iOS browser to its bare launch scheme, which
 * foregrounds the app on whatever tab it was showing. Deliberately carries
 * NO url payload: navigation-style schemes (`googlechromes://<url>`,
 * `firefox://open-url?...`) reload the dApp page, wiping in-flight state
 * like a pending swap result — the exact QA regression on this ticket.
 *
 * Null for browsers with no focus-only scheme (Safari, DuckDuckGo, Opera,
 * unknown): reloading them would be worse than showing no button, and the
 * iOS back-to-app chevron still covers the return.
 *
 * `Linking.openURL` needs no LSApplicationQueriesSchemes entry (only
 * `canOpenURL` does); a scheme with no installed handler rejects, which the
 * caller catches.
 */
export const buildIosBrowserFocusUrl = (
    browserName: string | undefined,
): string | null => {
    if (!browserName) return null
    const name = browserName.toLowerCase()

    if (name.includes('safari')) return null
    if (name.includes('chrome')) return 'googlechrome://'
    if (name.includes('firefox')) return 'firefox://'
    if (name.includes('brave')) return 'brave://'
    if (name.includes('edge')) return 'microsoft-edge://'
    return null
}

/**
 * Sends the user back to the dApp after a WalletConnect action that arrived
 * via an OS deep link from a mobile browser.
 *
 * Android: the browser task that fired the wc: intent sits directly behind
 * ours, so exiting the activity reveals the exact tab, state intact — no
 * browser hint needed. iOS has no task-stack equivalent, so we foreground
 * the initiating browser via its bare launch scheme.
 */
export const useReturnToDapp = (): UseReturnToDappResult => {
    const canReturnToDapp = useCallback(
        (args: ReturnToDappArgs): boolean =>
            Platform.OS === 'android' ||
            buildIosBrowserFocusUrl(args.browserName) !== null,
        [],
    )

    const returnToDapp = useCallback(
        async ({ browserName }: ReturnToDappArgs): Promise<void> => {
            if (Platform.OS === 'android') {
                BackHandler.exitApp()
                return
            }
            const focusUrl = buildIosBrowserFocusUrl(browserName)
            if (!focusUrl) return
            try {
                await Linking.openURL(focusUrl)
            } catch (error) {
                // The hinted browser is gone (uninstalled since pairing).
                // Deliberately NO navigation fallback: opening the dApp's
                // url would reload the page and wipe in-flight state — the
                // exact regression this hook exists to avoid.
                logger.warn('[wc/return-to-dapp] failed to focus browser', {
                    error,
                })
            }
        },
        [],
    )

    return { canReturnToDapp, returnToDapp }
}
