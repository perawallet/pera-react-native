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

import { http, HttpResponse, type HttpHandler } from 'msw'
import { validateMockResponse } from '@perawallet/wallet-core-shared/test-utils'
import {
    notificationStatusResponseSchema,
    notificationsListResponseSchema,
    messageStatusResponseSchema,
    type NotificationStatusResponse,
    type NotificationsListResponse,
    type MessageStatusResponse,
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
}: MockNotificationStatusParams): HttpHandler => {
    validateMockResponse(
        notificationStatusResponseSchema,
        response,
        'mockNotificationStatus',
    )
    return http.get(`*/v1/devices/${deviceID}/notification-status/`, () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockMessageStatusParams = {
    deviceID: string
    response: MessageStatusResponse
    status?: number
}

export const mockMessageStatus = ({
    deviceID,
    response,
    status = 200,
}: MockMessageStatusParams): HttpHandler => {
    validateMockResponse(
        messageStatusResponseSchema,
        response,
        'mockMessageStatus',
    )
    return http.get(`*/api/v3/devices/${deviceID}/message-status`, () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockNotificationListParams = {
    deviceID: string
    response: NotificationsListResponse
    status?: number
}

export const mockNotificationList = ({
    deviceID,
    response,
    status = 200,
}: MockNotificationListParams): HttpHandler => {
    validateMockResponse(
        notificationsListResponseSchema,
        response,
        'mockNotificationList',
    )
    return http.get(`*/v2/devices/${deviceID}/notifications/`, () =>
        HttpResponse.json(response, { status }),
    )
}

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
