/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { http, HttpResponse, type HttpHandler } from 'msw'
import type {
    NotificationStatusResponse,
    NotificationsListResponse,
} from './schema'

export type MockNotificationStatusParams = {
    deviceID: string
    response: NotificationStatusResponse
    status?: number
}

export const mockNotificationStatus = ({
    deviceID,
    response,
    status = 200,
}: MockNotificationStatusParams): HttpHandler =>
    http.get(`*/v1/devices/${deviceID}/notification-status/`, () =>
        HttpResponse.json(response, { status }),
    )

export type MockNotificationListParams = {
    deviceID: string
    response: NotificationsListResponse
    status?: number
}

export const mockNotificationList = ({
    deviceID,
    response,
    status = 200,
}: MockNotificationListParams): HttpHandler =>
    http.get(`*/v2/devices/${deviceID}/notifications/`, () =>
        HttpResponse.json(response, { status }),
    )

export type MockUpdateLastSeenNotificationParams = {
    deviceID: string
    status?: number
}

export const mockUpdateLastSeenNotification = ({
    deviceID,
    status = 204,
}: MockUpdateLastSeenNotificationParams): HttpHandler =>
    http.put(
        `*/v1/devices/${deviceID}/update-last-seen-notification/`,
        () => new HttpResponse(null, { status }),
    )

export type MockUpdateNotificationEnabledParams = {
    deviceID: string
    accountID: string
    response: NotificationStatusResponse
    status?: number
}

export const mockUpdateNotificationEnabled = ({
    deviceID,
    accountID,
    response,
    status = 200,
}: MockUpdateNotificationEnabledParams): HttpHandler =>
    http.patch(`*/v1/devices/${deviceID}/accounts/${accountID}/`, () =>
        HttpResponse.json(response, { status }),
    )
