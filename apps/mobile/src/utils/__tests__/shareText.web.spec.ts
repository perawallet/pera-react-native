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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// Explicit web filename — vitest has no Metro platform resolution.
import { shareText } from '../shareText.web'

const writeText = vi.fn()

const setNavigator = (share?: unknown): void => {
    Object.defineProperty(globalThis, 'navigator', {
        value: { share, clipboard: { writeText } },
        writable: true,
        configurable: true,
    })
}

describe('shareText.web', () => {
    beforeEach(() => {
        writeText.mockReset().mockResolvedValue(undefined)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('when the OS share sheet is unavailable', () => {
        beforeEach(() => setNavigator(undefined))

        // The condition on chrome-extension:// pages, where the native path
        // used to throw and leave the Share button silently dead.
        it('falls back to the clipboard', async () => {
            await shareText({ message: 'my address' })

            expect(writeText).toHaveBeenCalledWith('my address')
        })

        // Share.open renders message and url as separate fields; the clipboard
        // has one slot, so neither may be silently dropped.
        it('keeps both the message and the url', async () => {
            await shareText({ message: 'look', url: 'https://pera.app' })

            expect(writeText).toHaveBeenCalledWith('look\nhttps://pera.app')
        })
    })

    describe('when the OS share sheet is available', () => {
        it('uses it and does not touch the clipboard', async () => {
            const share = vi.fn().mockResolvedValue(undefined)
            setNavigator(share)

            await shareText({ message: 'hello', title: 'Pera' })

            expect(share).toHaveBeenCalledWith({
                text: 'hello',
                title: 'Pera',
                url: undefined,
            })
            expect(writeText).not.toHaveBeenCalled()
        })

        // Dismissing the sheet is a completed interaction, not a failure —
        // falling through would write to the clipboard behind the user's back.
        it('treats a user dismissal as done', async () => {
            const abort = new Error('dismissed')
            abort.name = 'AbortError'
            setNavigator(vi.fn().mockRejectedValue(abort))

            await shareText({ message: 'hello' })

            expect(writeText).not.toHaveBeenCalled()
        })

        it('falls back to the clipboard on any other failure', async () => {
            setNavigator(vi.fn().mockRejectedValue(new Error('unsupported')))

            await shareText({ message: 'hello' })

            expect(writeText).toHaveBeenCalledWith('hello')
        })
    })
})
