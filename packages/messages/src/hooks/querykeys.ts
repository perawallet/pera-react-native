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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Query } from '@tanstack/react-query'

const MODULE_PREFIX = 'notifications'

export const getNotificationsListQueryKey = (
    scope: ChainScope,
    deviceID: string,
) => {
    return [MODULE_PREFIX, 'listv2', { deviceID, scope }]
}

export const getNotificationStatusQueryKey = (
    scope: ChainScope,
    deviceID: string,
) => {
    return [MODULE_PREFIX, 'notification-status', { deviceID, scope }]
}

export const getMessageStatusQueryKey = (
    scope: ChainScope,
    deviceID: string,
) => {
    return [MODULE_PREFIX, 'message-status', { deviceID, scope }]
}

export const getInboxQueryKey = (
    scope: ChainScope,
    deviceID: string,
    addresses: string[],
) => {
    return [MODULE_PREFIX, 'inbox', { deviceID, scope, addresses }]
}

export const invalidateAllPredicate = (query: Query) => {
    return query.queryKey.at(0) === MODULE_PREFIX
}
