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

import { describe, expect, test, vi } from 'vitest'
import { CloudFileNotFoundError } from '@perawallet/wallet-extension-platform'

import { resolveCandidate } from '../candidates'

const KEY = '{"t":"backup-credentials"}'
const NOT_KEY = '{"t":"something-else"}'

const options = (overrides = {}) => ({
    isCandidate: (name: string) => name === 'pera-backup-ABCDE.json',
    chooseFile: vi.fn(),
    ...overrides,
})

const byContents = (overrides = {}) =>
    options({ isCandidateContents: (c: string) => c === KEY, ...overrides })

describe('resolveCandidate', () => {
    test('returns the single name match without reading anything', async () => {
        const readEntry = vi.fn()

        const resolved = await resolveCandidate(
            ['pera-backup-ABCDE.json', 'notes.txt'],
            'googleDrive',
            options(),
            readEntry,
        )

        expect(resolved).toEqual({ fileName: 'pera-backup-ABCDE.json' })
        expect(readEntry).not.toHaveBeenCalled()
    })

    test('finds a renamed file by its contents', async () => {
        const readEntry = vi
            .fn()
            .mockResolvedValueOnce(NOT_KEY)
            .mockResolvedValueOnce(KEY)

        const resolved = await resolveCandidate(
            ['notes.txt', 'my-wallet-key.json'],
            'googleDrive',
            byContents(),
            readEntry,
        )

        expect(resolved).toEqual({
            fileName: 'my-wallet-key.json',
            contents: KEY,
        })
    })

    test('throws when neither the name nor the contents match', async () => {
        const readEntry = vi.fn().mockResolvedValue(NOT_KEY)

        await expect(
            resolveCandidate(
                ['notes.txt'],
                'googleDrive',
                byContents(),
                readEntry,
            ),
        ).rejects.toBeInstanceOf(CloudFileNotFoundError)
        expect(readEntry).toHaveBeenCalled()
    })

    test('skips an entry it cannot read', async () => {
        const readEntry = vi
            .fn()
            .mockRejectedValueOnce(new Error('unreadable'))
            .mockResolvedValueOnce(KEY)

        const resolved = await resolveCandidate(
            ['locked.json', 'my-wallet-key.json'],
            'googleDrive',
            byContents(),
            readEntry,
        )

        expect(resolved).toEqual({
            fileName: 'my-wallet-key.json',
            contents: KEY,
        })
    })

    test('skips an entry the store declined to hand over', async () => {
        const readEntry = vi
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(KEY)

        const resolved = await resolveCandidate(
            ['huge.json', 'my-wallet-key.json'],
            'googleDrive',
            byContents(),
            readEntry,
        )

        expect(resolved).toEqual({
            fileName: 'my-wallet-key.json',
            contents: KEY,
        })
    })

    test('hands the store a byte ceiling with every entry it probes', async () => {
        const readEntry = vi.fn().mockResolvedValue(NOT_KEY)

        await expect(
            resolveCandidate(
                ['notes.txt'],
                'googleDrive',
                byContents(),
                readEntry,
            ),
        ).rejects.toBeInstanceOf(CloudFileNotFoundError)

        const [, maxBytes] = readEntry.mock.calls[0]
        expect(maxBytes).toBeGreaterThan(KEY.length)
        expect(Number.isFinite(maxBytes)).toBe(true)
    })

    test('reads at most ten entries', async () => {
        const readEntry = vi.fn().mockResolvedValue(NOT_KEY)
        const entries = Array.from({ length: 25 }, (_, i) => `file-${i}.json`)

        await expect(
            resolveCandidate(entries, 'googleDrive', byContents(), readEntry),
        ).rejects.toBeInstanceOf(CloudFileNotFoundError)

        expect(readEntry).toHaveBeenCalledTimes(10)
    })

    test('asks the user when several files match by content', async () => {
        const chooseFile = vi.fn().mockResolvedValue('b.json')

        const resolved = await resolveCandidate(
            ['a.json', 'b.json'],
            'googleDrive',
            byContents({ chooseFile }),
            vi.fn().mockResolvedValue(KEY),
        )

        expect(chooseFile).toHaveBeenCalledWith(['a.json', 'b.json'])
        expect(resolved).toEqual({ fileName: 'b.json', contents: KEY })
    })

    test('reads nothing more when the user backs out of the picker', async () => {
        const chooseFile = vi.fn().mockResolvedValue(null)

        const resolved = await resolveCandidate(
            ['a.json', 'b.json'],
            'googleDrive',
            byContents({ chooseFile }),
            vi.fn().mockResolvedValue(KEY),
        )

        expect(resolved).toBeNull()
    })
})
