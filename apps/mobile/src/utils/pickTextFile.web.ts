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

export type PickedTextFile = {
    name: string
    contents: string
    /** Bytes, so a caller can refuse an implausibly large file before parsing. */
    size: number
}

const readAsText = (file: globalThis.File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () =>
            reject(reader.error ?? new Error('Failed to read the file'))
        reader.readAsText(file)
    })

/**
 * `expo-file-system`'s browser shim has no real `File.pickFileAsync` — it
 * `console.warn`s and resolves `undefined` (see `ExpoFileSystem.web.ts`), which
 * the native callers' `.uri` access then throws on. Drive the standard browser
 * flow instead: a hidden `<input type="file">`, clicked synchronously from the
 * caller's click handler so the picker opens under the user gesture browsers
 * require, then `FileReader.readAsText()`.
 *
 * Resolves `null` when the user dismisses the picker — detected via the
 * input's `cancel` event, supported in every Chromium/Firefox this extension
 * ships to.
 *
 * Callers on the 360x600 toolbar popup must not reach this: the file dialog is
 * an OS window and Chrome tears the popup down the instant it takes focus, so
 * the picker opens over a dead surface and neither listener ever runs.
 */
export const pickTextFile = (accept: string): Promise<PickedTextFile | null> =>
    new Promise((resolve, reject) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = accept
        input.style.display = 'none'

        const cleanup = () => {
            input.removeEventListener('change', handleChange)
            input.removeEventListener('cancel', handleCancel)
            input.remove()
        }

        const handleChange = () => {
            const file = input.files?.[0] ?? null
            cleanup()
            if (!file) {
                resolve(null)
                return
            }
            readAsText(file)
                .then(contents =>
                    resolve({ name: file.name, contents, size: file.size }),
                )
                .catch(reject)
        }

        const handleCancel = () => {
            cleanup()
            resolve(null)
        }

        input.addEventListener('change', handleChange)
        input.addEventListener('cancel', handleCancel)

        document.body.appendChild(input)
        input.click()
    })
