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

import type { Nullable } from '@perawallet/wallet-core-shared'
import type { WidgetInboxFeed } from './snapshot'

type ResolveInboxFeedParams = {
    /** False where the network has the inbox switched off. */
    isAvailable: boolean
    isPrivacyMode: boolean
    deviceId: Nullable<string>
    addresses: string[]
    accountNames: { address: string; name: string }[]
    notificationsBackendUrl: string
    notificationsDeviceId: Nullable<string>
}

/** Null when the inbox can't be fetched: no device yet, no accounts, or switched off. */
export const resolveInboxFeed = ({
    isAvailable,
    isPrivacyMode,
    deviceId,
    addresses,
    accountNames,
    notificationsBackendUrl,
    notificationsDeviceId,
}: ResolveInboxFeedParams): WidgetInboxFeed => {
    if (!isAvailable || isPrivacyMode || !deviceId || addresses.length === 0) {
        return null
    }
    return {
        deviceId,
        addresses,
        accountNames,
        notifications:
            notificationsBackendUrl && notificationsDeviceId
                ? {
                      backendUrl: notificationsBackendUrl,
                      deviceId: notificationsDeviceId,
                  }
                : null,
    }
}
