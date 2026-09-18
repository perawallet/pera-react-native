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
import { shareFile } from '../shareFile.web'

describe('shareFile (web)', () => {
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
    })

    it('downloads binary content as a typed blob through an anchor', async () => {
        await shareFile(
            'statement.pdf',
            new Uint8Array([37, 80, 68, 70]),
            'application/pdf',
        )

        const [blob] = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock
            .calls[0] as [Blob]
        expect(blob.type).toBe('application/pdf')
        expect(blob.size).toBe(4)
        expect(mockAnchor.href).toBe(mockObjectUrl)
        expect(mockAnchor.download).toBe('statement.pdf')
        expect(mockAnchor.click).toHaveBeenCalledTimes(1)
    })

    it('revokes the object URL even when the click throws', async () => {
        mockAnchor.click.mockImplementationOnce(() => {
            throw new Error('blocked')
        })

        await expect(
            shareFile('statement.pdf', 'x', 'application/pdf'),
        ).rejects.toThrow('blocked')
        expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectUrl)
    })
})
