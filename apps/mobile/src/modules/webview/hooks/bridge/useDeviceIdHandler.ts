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

import { useCallback, useEffect, useRef } from 'react'
import type WebView from 'react-native-webview'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { GET_DEVICE_ID_ACTION, sendActionToWebview } from '../handlers'
import type { BridgeHandler } from './types'

/**
 * Answers `getDeviceId`, and pushes the id unasked whenever it changes after
 * mount: `securedConnection` is the mount-level trust decision, the only one
 * available for a push that has no message frame to judge.
 */
export const useDeviceIdHandler = (
    webview: Nullable<WebView>,
    securedConnection: boolean,
): BridgeHandler => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)

    // Discover reads the device id once at load and only fetches server-side
    // favorites while it holds a non-null one — so an id arriving later (store
    // hydration, migration, re-registration) is never picked up, since it never
    // retries. Pushing changes refires its favorites fetch. The initial mount is
    // skipped, since getSettings already carried that value.
    const previousDeviceIDRef = useRef<string | null | undefined>(undefined)
    useEffect(() => {
        const previous = previousDeviceIDRef.current
        previousDeviceIDRef.current = deviceID
        if (previous === undefined) {
            return
        }
        if (previous === deviceID) {
            return
        }
        if (!securedConnection || !deviceID || !webview) {
            return
        }
        sendActionToWebview(GET_DEVICE_ID_ACTION, deviceID, webview)
    }, [deviceID, securedConnection, webview])

    return useCallback(() => {
        if (!deviceID) {
            return
        }
        sendActionToWebview(GET_DEVICE_ID_ACTION, deviceID, webview)
    }, [deviceID, webview])
}
