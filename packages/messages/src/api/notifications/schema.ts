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

export const notificationResponseSchema = z.object({
    id: z.coerce.string(),
    type: z.string().optional(),
    account_address: z.string(),
    message: z.string(),
    url: z.string(),
    creation_datetime: z.string(),
    is_unread: z.boolean().optional(),
    icon: z
        .object({
            logo: z.string().url(),
            shape: z.enum(['circle', 'rectangle']),
        })
        .nullable()
        .optional(),
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
