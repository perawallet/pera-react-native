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

import { describe, it, expect, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePickBackupFile } from '../usePickBackupFile.web'

// The hook drives a hidden `<input type="file">` it appends to `document.body`
// and clicks synchronously — jsdom doesn't show a real OS file chooser, so
// these tests grab that input off the document and dispatch the same
// `change`/`cancel` events a browser would fire.
const getFileInput = (): HTMLInputElement => {
    const input = document.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) {
        throw new Error('Expected a hidden file input to be in the document')
    }
    return input
}

describe('usePickBackupFile (web)', () => {
    afterEach(() => {
        document
            .querySelectorAll('input[type="file"]')
            .forEach(el => el.remove())
    })

    it('reads the selected file as text and returns its name and contents', async () => {
        const { result } = renderHook(() => usePickBackupFile())

        const pickPromise = result.current.pickFile()
        const input = getFileInput()

        const file = new File(['envelope-contents'], 'backup.txt', {
            type: 'text/plain',
        })
        Object.defineProperty(input, 'files', {
            value: [file],
            configurable: true,
        })
        input.dispatchEvent(new Event('change'))

        await expect(pickPromise).resolves.toEqual({
            name: 'backup.txt',
            contents: 'envelope-contents',
        })
    })

    it('removes the hidden input from the document after a selection', async () => {
        const { result } = renderHook(() => usePickBackupFile())

        const pickPromise = result.current.pickFile()
        const input = getFileInput()
        const file = new File(['contents'], 'backup.txt', {
            type: 'text/plain',
        })
        Object.defineProperty(input, 'files', {
            value: [file],
            configurable: true,
        })
        input.dispatchEvent(new Event('change'))
        await pickPromise

        expect(document.querySelector('input[type="file"]')).toBeNull()
    })

    it('resolves null when the user dismisses the picker without choosing a file', async () => {
        const { result } = renderHook(() => usePickBackupFile())

        const pickPromise = result.current.pickFile()
        const input = getFileInput()
        input.dispatchEvent(new Event('cancel'))

        await expect(pickPromise).resolves.toBeNull()
    })

    it('resolves null when change fires with no file selected', async () => {
        const { result } = renderHook(() => usePickBackupFile())

        const pickPromise = result.current.pickFile()
        const input = getFileInput()
        Object.defineProperty(input, 'files', { value: [], configurable: true })
        input.dispatchEvent(new Event('change'))

        await expect(pickPromise).resolves.toBeNull()
    })
})
