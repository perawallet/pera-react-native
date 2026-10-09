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

import { describe, expect, it, vi } from 'vitest'
import {
    createStorageAnsweredRequests,
    MAX_ANSWERED_REQUESTS_PER_SESSION,
} from '../answeredRequests'

const memoryPersistence = () => {
    const entries = new Map<string, string>()
    return {
        entries,
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => void entries.set(key, value),
        removeItem: (key: string) => void entries.delete(key),
    }
}

describe('createStorageAnsweredRequests', () => {
    it('remembers an answered request per session', () => {
        const persistence = memoryPersistence()
        const ledger = createStorageAnsweredRequests(() => persistence)

        ledger.record('c1', 7)

        expect(ledger.has('c1', 7)).toBe(true)
        expect(ledger.has('c1', 8)).toBe(false)
        expect(ledger.has('c2', 7)).toBe(false)
    })

    it('evicts the oldest ids past the per-session cap', () => {
        const persistence = memoryPersistence()
        const ledger = createStorageAnsweredRequests(() => persistence)

        for (let id = 1; id <= MAX_ANSWERED_REQUESTS_PER_SESSION + 1; id++) {
            ledger.record('c1', id)
        }

        expect(ledger.has('c1', 1)).toBe(false)
        expect(ledger.has('c1', 2)).toBe(true)
        expect(ledger.has('c1', MAX_ANSWERED_REQUESTS_PER_SESSION + 1)).toBe(
            true,
        )
    })

    it('does not grow when the same id is recorded twice', () => {
        const persistence = memoryPersistence()
        const ledger = createStorageAnsweredRequests(() => persistence)

        ledger.record('c1', 7)
        ledger.record('c1', 7)

        expect(
            JSON.parse(persistence.entries.get('wc1-answered:c1') ?? ''),
        ).toEqual(['7'])
    })

    it('reads a corrupt row as empty and overwrites it on the next record', () => {
        const persistence = memoryPersistence()
        persistence.entries.set('wc1-answered:c1', '{not json')
        const ledger = createStorageAnsweredRequests(() => persistence)

        expect(ledger.has('c1', 7)).toBe(false)
        ledger.record('c1', 7)
        expect(ledger.has('c1', 7)).toBe(true)
    })

    it('fails open and never throws when storage faults', () => {
        const ledger = createStorageAnsweredRequests(() => ({
            getItem: vi.fn(() => {
                throw new Error('storage unavailable')
            }),
            setItem: vi.fn(),
            removeItem: vi.fn(() => {
                throw new Error('storage unavailable')
            }),
        }))

        expect(ledger.has('c1', 7)).toBe(false)
        expect(() => ledger.record('c1', 7)).not.toThrow()
        expect(() => ledger.forget('c1')).not.toThrow()
    })

    it('forgets every id of a session', () => {
        const persistence = memoryPersistence()
        const ledger = createStorageAnsweredRequests(() => persistence)
        ledger.record('c1', 7)
        ledger.record('c2', 7)

        ledger.forget('c1')

        expect(ledger.has('c1', 7)).toBe(false)
        expect(ledger.has('c2', 7)).toBe(true)
    })
})
