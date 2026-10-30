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

import { useEffect } from 'react'
import * as QuickActions from 'expo-quick-actions'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { routeCapabilities } from '@routes/capabilities'
import { useDeepLink } from './useDeepLink'

const SCAN_ACTION_ID = 'scan'
const SCAN_URL = 'perawallet://app/scan/'

let handledLaunchAction: Optional<QuickActions.Action>

// Ids map to fixed URLs: an action's params come from the OS and are never
// turned into a link.
const URL_BY_ACTION: Readonly<Record<string, string>> = {
    [SCAN_ACTION_ID]: SCAN_URL,
}

/** The app icon's long-press menu. Set at runtime so the titles follow the app language. */
export const useAppQuickActions = (): void => {
    const { t } = useLanguage()
    const { handleDeepLink } = useDeepLink()

    useEffect(() => {
        void QuickActions.setItems(
            routeCapabilities.qrScanner
                ? [
                      {
                          id: SCAN_ACTION_ID,
                          title: t('address_entry.scan_qr'),
                          icon: 'symbol:qrcode.viewfinder',
                      },
                  ]
                : [],
        )
    }, [t])

    useEffect(() => {
        const open = (actionId: string) => {
            const url = URL_BY_ACTION[actionId]
            if (url) void handleDeepLink(url, false, 'in-app')
        }

        // The action that launched the app is delivered before any listener
        // exists, and must be handled once even if this effect re-runs.
        const launchAction = QuickActions.initial
        if (launchAction && launchAction !== handledLaunchAction) {
            handledLaunchAction = launchAction
            open(launchAction.id)
        }
        const subscription = QuickActions.addListener(action => open(action.id))
        return () => subscription.remove()
    }, [handleDeepLink])
}
