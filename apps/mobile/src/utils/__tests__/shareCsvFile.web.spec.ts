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
import { shareCsvFile } from '../shareCsvFile.web'

vi.mock('@perawallet/wallet-core-transactions', () => ({
    CSV_MIME_TYPE: 'text/csv',
}))

describe('shareCsvFile (web)', () => {
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

    it('builds a CSV blob and triggers a download via a temporary anchor', async () => {
        await shareCsvFile('tx.csv', 'a,b,c')

        expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
        const [blob] = vi.mocked(URL.createObjectURL).mock.calls[0]
        expect(blob).toBeInstanceOf(Blob)
        expect((blob as Blob).type).toBe('text/csv')

        expect(mockAnchor.href).toBe(mockObjectUrl)
        expect(mockAnchor.download).toBe('tx.csv')
        expect(mockAnchor.click).toHaveBeenCalledTimes(1)
    })

    it('revokes the object URL after triggering the download', async () => {
        await shareCsvFile('tx.csv', 'data')

        expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectUrl)
    })

    it('revokes the object URL even if the click throws', async () => {
        mockAnchor.click.mockImplementationOnce(() => {
            throw new Error('click failed')
        })

        await expect(shareCsvFile('tx.csv', 'data')).rejects.toThrow(
            'click failed',
        )
        expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectUrl)
    })
})
