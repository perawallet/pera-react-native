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

import { z } from 'zod'

export const notificationStatusResponseSchema = z.object({
    has_new_notification: z.boolean().optional().default(false),
})

// Mirror the native apps' leniency: every field except `id` and
// `creation_datetime` may be null or absent depending on the notification
// type (e.g. rekey notifications carry no deeplink target), so only reject
// rows that can't be keyed or sorted.
export const notificationResponseSchema = z.object({
    id: z.coerce.string(),
    type: z.string().nullish(),
    account_address: z.string().nullish(),
    message: z.string().nullish(),
    url: z.string().nullish(),
    creation_datetime: z.string(),
    is_unread: z.boolean().nullish(),
    icon: z
        .object({
            logo: z.string().url(),
            shape: z.enum(['circle', 'rectangle']),
        })
        .nullish(),
})

export const messageStatusResponseSchema = z.object({
    hasUnreadItems: z.boolean(),
    hasUnreadNotifications: z.boolean(),
    hasUnreadInboxItems: z.boolean(),
    unreadInboxCount: z.number().optional().default(0),
})

export const notificationsListResponseSchema = z.object({
    results: z.array(notificationResponseSchema),
    next: z.string().nullable(),
    previous: z.string().nullable(),
})

export type NotificationStatusResponse = z.infer<
    typeof notificationStatusResponseSchema
>
export type NotificationResponse = z.infer<typeof notificationResponseSchema>
export type NotificationsListResponse = z.infer<
    typeof notificationsListResponseSchema
>
export type MessageStatusResponse = z.infer<typeof messageStatusResponseSchema>
