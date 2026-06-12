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

import { describe, test, expect } from 'vitest'
import {
    notificationStatusResponseSchema,
    notificationResponseSchema,
    notificationsListResponseSchema,
    messageStatusResponseSchema,
} from '../schema'

describe('notificationStatusResponseSchema', () => {
    test('parses a valid status response', () => {
        const input = { has_new_notification: true }
        const result = notificationStatusResponseSchema.parse(input)
        expect(result).toEqual(input)
    })

    test('parses when has_new_notification is false', () => {
        const input = { has_new_notification: false }
        const result = notificationStatusResponseSchema.parse(input)
        expect(result.has_new_notification).toBe(false)
    })

    test('defaults has_new_notification to false when missing', () => {
        const result = notificationStatusResponseSchema.parse({})
        expect(result.has_new_notification).toBe(false)
    })

    test('rejects non-boolean has_new_notification', () => {
        expect(() =>
            notificationStatusResponseSchema.parse({
                has_new_notification: 'yes',
            }),
        ).toThrow()
    })
})

describe('messageStatusResponseSchema', () => {
    const validStatus = {
        hasUnreadItems: true,
        hasUnreadNotifications: true,
        hasUnreadInboxItems: false,
        unreadInboxCount: 3,
    }

    test('parses a valid status response with the inbox count', () => {
        const result = messageStatusResponseSchema.parse(validStatus)
        expect(result).toEqual(validStatus)
    })

    test('defaults unreadInboxCount to 0 when missing', () => {
        const { unreadInboxCount, ...withoutCount } = validStatus
        void unreadInboxCount
        const result = messageStatusResponseSchema.parse(withoutCount)
        expect(result.unreadInboxCount).toBe(0)
    })

    test('rejects a non-number unreadInboxCount', () => {
        expect(() =>
            messageStatusResponseSchema.parse({
                ...validStatus,
                unreadInboxCount: 'three',
            }),
        ).toThrow()
    })

    test('rejects missing required flags', () => {
        expect(() =>
            messageStatusResponseSchema.parse({ hasUnreadItems: true }),
        ).toThrow()
    })
})

describe('notificationResponseSchema', () => {
    const validNotification = {
        id: '1',
        account_address: 'TESTADDR123',
        message: 'Test Message',
        url: 'perawallet://account-detail?address=TESTADDR123',
        creation_datetime: '2025-01-01T00:00:00Z',
        is_unread: true,
        icon: {
            logo: 'https://example.com/icon.png',
            shape: 'circle' as const,
        },
    }

    test('parses a valid notification', () => {
        const result = notificationResponseSchema.parse(validNotification)
        expect(result).toEqual(validNotification)
    })

    test('parses without optional fields', () => {
        const input = {
            id: '1',
            account_address: 'TESTADDR123',
            message: 'Message',
            url: 'perawallet://home',
            creation_datetime: '2025-01-01T00:00:00Z',
        }
        const result = notificationResponseSchema.parse(input)
        expect(result.id).toBe('1')
        expect(result.type).toBeUndefined()
    })

    test('parses with a type field', () => {
        const input = {
            ...validNotification,
            type: 'multisig-new-sign-request',
        }
        const result = notificationResponseSchema.parse(input)
        expect(result.type).toBe('multisig-new-sign-request')
    })

    test('parses with null icon', () => {
        const input = {
            ...validNotification,
            icon: null,
        }
        const result = notificationResponseSchema.parse(input)
        expect(result.icon).toBeNull()
    })

    test('parses rekey-style rows with null url, account_address and type', () => {
        const input = {
            id: '3',
            type: null,
            account_address: null,
            message: 'Your account was rekeyed',
            url: null,
            creation_datetime: '2025-01-01T00:00:00Z',
        }
        const result = notificationResponseSchema.parse(input)
        expect(result.url).toBeNull()
        expect(result.account_address).toBeNull()
        expect(result.type).toBeNull()
    })

    test('rejects rows without creation_datetime', () => {
        expect(() => notificationResponseSchema.parse({ id: '1' })).toThrow()
    })

    test('coerces numeric id to string', () => {
        const input = { ...validNotification, id: 64298411 }
        const result = notificationResponseSchema.parse(input)
        expect(result.id).toBe('64298411')
    })

    test('rejects invalid icon shape', () => {
        expect(() =>
            notificationResponseSchema.parse({
                ...validNotification,
                icon: {
                    logo: 'https://example.com/icon.png',
                    shape: 'triangle',
                },
            }),
        ).toThrow()
    })
})

describe('notificationsListResponseSchema', () => {
    const validList = {
        results: [
            {
                id: '1',
                account_address: 'TESTADDR123',
                message: 'Message',
                url: 'perawallet://home',
                creation_datetime: '2025-01-01T00:00:00Z',
            },
        ],
        next: 'cursor-abc',
        previous: null,
    }

    test('parses a valid list response', () => {
        const result = notificationsListResponseSchema.parse(validList)
        expect(result.results).toHaveLength(1)
        expect(result.next).toBe('cursor-abc')
        expect(result.previous).toBeNull()
    })

    test('parses an empty results list', () => {
        const input = { results: [], next: null, previous: null }
        const result = notificationsListResponseSchema.parse(input)
        expect(result.results).toHaveLength(0)
    })

    test('parses with both cursors null', () => {
        const input = { ...validList, next: null }
        const result = notificationsListResponseSchema.parse(input)
        expect(result.next).toBeNull()
    })

    test('rejects missing results', () => {
        expect(() =>
            notificationsListResponseSchema.parse({
                next: null,
                previous: null,
            }),
        ).toThrow()
    })

    test('rejects non-array results', () => {
        expect(() =>
            notificationsListResponseSchema.parse({
                results: 'not-an-array',
                next: null,
                previous: null,
            }),
        ).toThrow()
    })
})
