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
import { saveImageToDevice } from '../saveImageToDevice.web'

describe('saveImageToDevice (web)', () => {
    const mockObjectUrl = 'blob:mock-object-url'
    const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockAnchor.href = ''
        mockAnchor.download = ''

        URL.createObjectURL = vi.fn().mockReturnValue(mockObjectUrl)
        URL.revokeObjectURL = vi.fn()

        vi.spyOn(document, 'createElement').mockReturnValue(
            mockAnchor as unknown as HTMLAnchorElement,
        )

        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                blob: () =>
                    Promise.resolve(
                        new Blob(['fake-bytes'], { type: 'image/png' }),
                    ),
            }),
        )
    })

    it('fetches the media and triggers a download via a temporary anchor', async () => {
        await saveImageToDevice(
            'https://example.com/full.png',
            'collectible_12345.png',
        )

        expect(fetch).toHaveBeenCalledWith('https://example.com/full.png')
        expect(mockAnchor.href).toBe(mockObjectUrl)
        expect(mockAnchor.download).toBe('collectible_12345.png')
        expect(mockAnchor.click).toHaveBeenCalledTimes(1)
        expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectUrl)
    })

    it('throws when the fetch response is not ok, without triggering a download', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, status: 500 }),
        )

        await expect(
            saveImageToDevice('https://example.com/full.png', 'file.png'),
        ).rejects.toThrow('500')

        expect(mockAnchor.click).not.toHaveBeenCalled()
    })

    it('revokes the object URL even if the click throws', async () => {
        mockAnchor.click.mockImplementationOnce(() => {
            throw new Error('click failed')
        })

        await expect(
            saveImageToDevice('https://example.com/full.png', 'file.png'),
        ).rejects.toThrow('click failed')
        expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectUrl)
    })
})
