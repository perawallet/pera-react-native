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

import { afterEach, describe, expect, test, vi } from 'vitest'
import { pickTextFile } from '../pickTextFile.web'

// jsdom shows no OS chooser, so the tests grab the hidden input the util
// appends and fire the same events a browser would.
const fileInput = (): HTMLInputElement => {
    const input = document.querySelector('input[type="file"]')
    if (!(input instanceof HTMLInputElement)) {
        throw new Error('Expected a hidden file input to be in the document')
    }
    return input
}

const choose = (file: File): void => {
    const input = fileInput()
    Object.defineProperty(input, 'files', { value: [file] })
    input.dispatchEvent(new Event('change'))
}

afterEach(() =>
    document.querySelectorAll('input[type="file"]').forEach(el => el.remove()),
)

describe('pickTextFile', () => {
    test('reports the picked file without reading it', async () => {
        const readAsText = vi.spyOn(FileReader.prototype, 'readAsText')

        const picking = pickTextFile('.json')
        choose(new File(['{"salt":"a"}'], 'key.json'))
        const picked = await picking

        expect(picked).toMatchObject({ name: 'key.json', size: 12 })
        // The whole point of deferring: a caller can refuse a huge file on
        // `size` alone, before it is buffered into the extension's memory.
        expect(readAsText).not.toHaveBeenCalled()
    })

    test('reads the contents only when text() is called', async () => {
        const picking = pickTextFile('.json')
        choose(new File(['{"salt":"a"}'], 'key.json'))
        const picked = await picking

        await expect(picked?.text()).resolves.toBe('{"salt":"a"}')
    })

    test('resolves null when the user dismisses the picker', async () => {
        const picking = pickTextFile('.json')
        fileInput().dispatchEvent(new Event('cancel'))

        await expect(picking).resolves.toBeNull()
    })

    test('resolves null when the picker returns no file', async () => {
        const picking = pickTextFile('.json')
        fileInput().dispatchEvent(new Event('change'))

        await expect(picking).resolves.toBeNull()
    })

    test('leaves no input behind once a pick settles', async () => {
        const picking = pickTextFile('.json')
        choose(new File(['x'], 'key.json'))
        await picking

        expect(document.querySelector('input[type="file"]')).toBeNull()
    })

    test('surfaces a read failure from text()', async () => {
        vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(
            function (this: FileReader) {
                this.onerror?.(
                    new ProgressEvent('error') as ProgressEvent & Event,
                )
            },
        )

        const picking = pickTextFile('.json')
        choose(new File(['x'], 'key.json'))
        const picked = await picking

        await expect(picked?.text()).rejects.toThrow()
    })
})
