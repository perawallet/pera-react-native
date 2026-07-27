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

        expect(fetch).toHaveBeenCalledWith('https://example.com/nft.png')
        // jsdom's FileReader produces a real data URL; just assert the
        // "data:...;base64," prefix was stripped and something was returned.
        expect(result.length).toBeGreaterThan(0)
        expect(result).not.toContain('data:')

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
