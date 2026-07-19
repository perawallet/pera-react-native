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

import { useCallback } from 'react'
import type {
    PickedBackupFile,
    UsePickBackupFileResult,
} from './usePickBackupFile'

const readAsText = (file: globalThis.File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result ?? ''))
        reader.onerror = () =>
            reject(reader.error ?? new Error('Failed to read backup file'))
        reader.readAsText(file)
    })

/**
 * Web: `expo-file-system`'s browser shim has no real implementation of
 * `File.pickFileAsync` — it just `console.warn`s and resolves `undefined`
 * (see `ExpoFileSystem.web.ts` in the `expo-file-system` package), which the
 * native hook's `.uri` access then throws on. Drive the standard browser
 * file-input flow instead: a hidden `<input type="file">`, clicked
 * synchronously from the caller's click handler so the picker opens under
 * the user-gesture the browser requires, then read via
 * `FileReader.readAsText()` — ASB backup files are base64 text (see
 * `parseBackupEnvelope`), not binary, so a text read matches what the
 * native path gets from `File#text()`.
 *
 * Cancellation is detected via the `cancel` event fired on the input when
 * the user dismisses the picker without choosing a file (supported in all
 * Chromium/Firefox versions this extension ships to).
 */
export const usePickBackupFile = (): UsePickBackupFileResult => {
    const pickFile = useCallback((): Promise<PickedBackupFile | null> => {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.txt,text/plain'
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
                    .then(contents => resolve({ name: file.name, contents }))
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
    }, [])

    return { pickFile }
}
