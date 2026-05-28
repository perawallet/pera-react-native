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

import { formatDatetime } from '@perawallet/wallet-core-shared'

/**
 * How the "Last used" value should be rendered. The component maps each kind to
 * the matching i18n string so translation stays in the view layer.
 */
export type LastUsedDisplay =
    | { kind: 'never' }
    | { kind: 'today' }
    | { kind: 'date'; value: string }

const isSameCalendarDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

/**
 * Maps a passkey's `lastUsedAt` (ms since epoch, populated natively from
 * `System.currentTimeMillis()` on Android and the equivalent on iOS) onto a
 * display descriptor: "Never" when absent, "Today" for the current day,
 * otherwise a formatted date.
 */
export const resolveLastUsed = (
    lastUsedAt: number | undefined,
    now: number = Date.now(),
): LastUsedDisplay => {
    if (typeof lastUsedAt !== 'number' || !Number.isFinite(lastUsedAt)) {
        return { kind: 'never' }
    }

    const used = new Date(lastUsedAt)
    if (isSameCalendarDay(used, new Date(now))) {
        return { kind: 'today' }
    }

    return {
        kind: 'date',
        value: formatDatetime(used, undefined, 'medium', 'date'),
    }
}
