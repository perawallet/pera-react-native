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

// The offscreen document is the architecture's long-lived stateful process
// (sqlite worker, WalletConnect sockets, warm polling), and this is the only
// thing that creates it. Its create-race guard was previously untested.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureOffscreenDocument } from '../offscreen'

const setOffscreen = (offscreen: {
    hasDocument: () => Promise<boolean>
    createDocument: (...args: unknown[]) => Promise<void>
}): void => {
    ;(globalThis as unknown as { chrome: unknown }).chrome = { offscreen }
}

describe('ensureOffscreenDocument', () => {
    beforeEach(() => {
        delete (globalThis as unknown as { chrome?: unknown }).chrome
    })

    it('creates the document when none exists', async () => {
        const createDocument = vi.fn(async () => {})
        setOffscreen({ hasDocument: async () => false, createDocument })

        await ensureOffscreenDocument()

        expect(createDocument).toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'offscreen.html',
                reasons: ['WORKERS'],
            }),
        )
    })

    it('is a no-op when a document already exists', async () => {
        const createDocument = vi.fn(async () => {})
        setOffscreen({ hasDocument: async () => true, createDocument })

        await ensureOffscreenDocument()

        expect(createDocument).not.toHaveBeenCalled()
    })

    // Several UI contexts booting at once each send ensure-offscreen; only one
    // createDocument can win. Losing that race is success, not failure — the
    // caller wanted a document to exist, and one does.
    it('swallows a lost create race once a document exists', async () => {
        const createDocument = vi
            .fn()
            .mockRejectedValue(new Error('Only a single offscreen document'))
        let calls = 0
        setOffscreen({
            // Absent on the pre-flight check, present by the time the failed
            // create is re-checked — exactly the race window.
            hasDocument: async () => {
                calls += 1
                return calls > 1
            },
            createDocument,
        })

        await expect(ensureOffscreenDocument()).resolves.toBeUndefined()
    })

    // A create that failed for any other reason leaves the extension with no
    // database host, so it must propagate rather than look like success.
    it('rethrows when the create failed and still no document exists', async () => {
        setOffscreen({
            hasDocument: async () => false,
            createDocument: vi.fn().mockRejectedValue(new Error('boom')),
        })

        await expect(ensureOffscreenDocument()).rejects.toThrow('boom')
    })
})
