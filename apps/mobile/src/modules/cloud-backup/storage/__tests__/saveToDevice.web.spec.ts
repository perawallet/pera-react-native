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
import { shareFile } from '@utils/shareFile'
import { saveToDevice } from '../saveToDevice.web'

vi.mock('@utils/shareFile', () => ({
    shareFile: vi.fn(),
}))

describe('saveToDevice (web)', () => {
    test('downloads the file as JSON', async () => {
        vi.mocked(shareFile).mockResolvedValueOnce('shared')

        await expect(saveToDevice('key.json', '{}')).resolves.toBe('saved')
        expect(shareFile).toHaveBeenCalledWith('key.json', '{}', {
            mimeType: 'application/json',
        })
    })
})
