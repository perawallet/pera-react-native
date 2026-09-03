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

import type { Network } from '@perawallet/wallet-core-shared'
import type { Query } from '@tanstack/react-query'

const MODULE_PREFIX = 'notifications'

export const getNotificationsListQueryKey = (
    network: Network,
    deviceID: string,
) => {
    return [MODULE_PREFIX, 'listv2', { deviceID, network }]
}

export const getNotificationStatusQueryKey = (
    network: Network,
    deviceID: string,
) => {
    return [MODULE_PREFIX, 'notification-status', { deviceID, network }]
}

export const getMessageStatusQueryKey = (
    network: Network,
    deviceID: string,
) => {
    return [MODULE_PREFIX, 'message-status', { deviceID, network }]
}

export const getInboxQueryKey = (
    network: Network,
    deviceID: string,
    addresses: string[],
) => {
    return [MODULE_PREFIX, 'inbox', { deviceID, network, addresses }]
}

export const invalidateAllPredicate = (query: Query) => {
    return query.queryKey.at(0) === MODULE_PREFIX
}
