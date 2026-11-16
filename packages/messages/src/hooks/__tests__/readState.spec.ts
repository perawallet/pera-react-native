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

import { describe, it, expect } from 'vitest'
import {
    markMessageStatusNotificationsRead,
    markNotificationsReadUpTo,
} from '../readState'

const row = (id: string, isUnread: boolean | null) => ({
    id,
    creation_datetime: '2026-11-16T00:00:00Z',
    is_unread: isUnread,
})

describe('markNotificationsReadUpTo', () => {
    it('marks rows at or below the last seen id read, across pages', () => {
        const data = {
            pageParams: ['', 'next'],
            pages: [
                {
                    next: 'next',
                    previous: null,
                    results: [row('43', true), row('42', true)],
                },
                { next: null, previous: null, results: [row('7', null)] },
            ],
        }

        const result = markNotificationsReadUpTo(data, 42)

        expect(
            result.pages.flatMap(p => p.results.map(r => r.is_unread)),
        ).toEqual([true, false, false])
        expect(result.pageParams).toEqual(['', 'next'])
    })

    it('does not mutate the cached data', () => {
        const data = {
            pageParams: [''],
            pages: [{ next: null, previous: null, results: [row('1', true)] }],
        }

        markNotificationsReadUpTo(data, 1)

        expect(data.pages[0].results[0].is_unread).toBe(true)
    })
})

describe('markMessageStatusNotificationsRead', () => {
    it.each([true, false])(
        'clears notifications and keeps the inbox flag (%s)',
        hasUnreadInboxItems => {
            const result = markMessageStatusNotificationsRead({
                hasUnreadItems: true,
                hasUnreadNotifications: true,
                hasUnreadInboxItems,
                unreadInboxCount: hasUnreadInboxItems ? 2 : 0,
            })

            expect(result).toEqual({
                hasUnreadItems: hasUnreadInboxItems,
                hasUnreadNotifications: false,
                hasUnreadInboxItems,
                unreadInboxCount: hasUnreadInboxItems ? 2 : 0,
            })
        },
    )
})
