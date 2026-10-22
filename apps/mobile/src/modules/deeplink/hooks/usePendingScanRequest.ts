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
import { AppState } from 'react-native'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useDeepLink } from './useDeepLink'

const SCAN_URL = 'perawallet://app/scan/'

/**
 * Opens the scanner when the "Scan with Pera" control asked for it. The control
 * launches the app and leaves a flag in shared storage rather than opening a
 * URL, because a control's URL open can silently do nothing for a custom scheme.
 */
export const usePendingScanRequest = (): void => {
    const { handleDeepLink } = useDeepLink()

    useEffect(() => {
        const check = async () => {
            if (await getProvider().widgets.consumePendingScan()) {
                void handleDeepLink(SCAN_URL, false, 'in-app')
            }
        }

        void check()
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') void check()
        })
        // iOS can activate the app before the control records its request.
        const unsubscribe = getProvider().widgets.onScanRequested(() => {
            void check()
        })
        return () => {
            subscription.remove()
            unsubscribe()
        }
    }, [handleDeepLink])
}
