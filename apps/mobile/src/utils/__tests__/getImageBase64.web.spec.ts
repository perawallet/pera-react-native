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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getImageBase64 } from '../getImageBase64.web'

describe('getImageBase64 (web)', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('fetches the image and resolves its base64 bytes', async () => {
        const blob = new Blob(['fake-image-bytes'], { type: 'image/png' })
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                blob: () => Promise.resolve(blob),
            }),
        )

        const result = await getImageBase64(
            'https://example.com/nft.png',
            'unused',
        )

        expect(fetch).toHaveBeenCalledWith('https://example.com/nft.png', {
            signal: expect.anything(),
        })
        // jsdom's FileReader produces a real data URL; just assert the
        // "data:...;base64," prefix was stripped and something was returned.
        expect(result.length).toBeGreaterThan(0)
        expect(result).not.toContain('data:')

        vi.unstubAllGlobals()
    })

    it('bounds the download by a 30 s deadline', async () => {
        const signal = new AbortController().signal
        const timeout = vi
            .spyOn(AbortSignal, 'timeout')
            .mockReturnValueOnce(signal)
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            blob: () => Promise.resolve(new Blob(['bytes'])),
        })
        vi.stubGlobal('fetch', fetchMock)

        await getImageBase64('https://example.com/nft.png', 'unused')

        expect(timeout).toHaveBeenCalledWith(30_000)
        expect(fetchMock.mock.calls[0]![1]).toMatchObject({ signal })

        vi.unstubAllGlobals()
    })

    it('rejects when the deadline aborts the download', async () => {
        const timedOut = new Error('The operation timed out')
        timedOut.name = 'TimeoutError'
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timedOut))

        await expect(
            getImageBase64('https://example.com/nft.png', 'unused'),
        ).rejects.toBe(timedOut)

        vi.unstubAllGlobals()
    })

    it('throws when the fetch response is not ok', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, status: 404 }),
        )

        await expect(
            getImageBase64('https://example.com/missing.png', 'unused'),
        ).rejects.toThrow('404')

        vi.unstubAllGlobals()
    })
})
