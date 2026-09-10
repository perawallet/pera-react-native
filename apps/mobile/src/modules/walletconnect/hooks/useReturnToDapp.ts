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
 * Bare launch scheme only, NO url payload: navigation schemes
 * (`googlechromes://<url>`, `firefox://open-url?...`) reload the dApp page and
 * wipe in-flight state such as a pending swap result. Null for browsers with no
 * focus-only scheme (Safari, DuckDuckGo, Opera); the iOS back-to-app chevron
 * covers those. `Linking.openURL` needs no LSApplicationQueriesSchemes entry
 * (only `canOpenURL` does); a scheme with no handler rejects.
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

// Android: the browser task that fired the wc: intent sits directly behind ours,
// so exiting the activity reveals the exact tab. iOS has no task stack, so the
// initiating browser is foregrounded via its bare launch scheme.
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
                // The hinted browser was uninstalled since pairing. NO navigation
                // fallback: opening the dApp url would reload the page and wipe in-flight state.
                logger.warn('[wc/return-to-dapp] failed to focus browser', {
                    error,
                })
            }
        },
        [],
    )

    return { canReturnToDapp, returnToDapp }
}
