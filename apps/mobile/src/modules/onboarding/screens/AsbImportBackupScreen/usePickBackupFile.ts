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
import { File } from 'expo-file-system'

export type PickedBackupFile = {
    name: string
    contents: string
}

export type UsePickBackupFileResult = {
    /**
     * Opens the platform file picker for a single ASB backup file and
     * resolves its name and text contents. Resolves `null` when the user
     * dismisses the picker without choosing a file; rejects with the
     * original error for any other failure so the caller can surface it.
     *
     * When `isPopupHandoff` is true this never picks anything: it opens the
     * expanded tab and resolves `null`.
     */
    pickFile: () => Promise<PickedBackupFile | null>
    /**
     * True only in the browser extension's toolbar popup, where `pickFile`
     * hands off to the expanded tab instead of picking. Callers use it to
     * label the affordance accordingly.
     */
    isPopupHandoff: boolean
}

const isCancelError = (e: unknown): boolean => {
    const message = String((e as { message?: unknown })?.message ?? '')
    return /cancel/i.test(message)
}

/**
 * Native: opens the system document picker via `expo-file-system`. See the
 * `.web.ts` twin — `expo-file-system` has no real browser implementation
 * (its web shim just warns and resolves `undefined`), so the browser build
 * instead drives a hidden `<input type="file">` + `FileReader`.
 */
export const usePickBackupFile = (): UsePickBackupFileResult => {
    const pickFile = useCallback(async (): Promise<PickedBackupFile | null> => {
        try {
            // `File.pickFileAsync` returns a single `File` when invoked
            // without the multi-select option; the typed return is a union
            // to accommodate the (unused here) multi-pick path.
            const result = await File.pickFileAsync(undefined, 'text/plain')
            const file = Array.isArray(result) ? result[0] : result
            if (!file) return null
            const contents = await file.text()
            return { name: file.name, contents }
        } catch (e) {
            // The native picker rejects with `FilePickingCancelledException`
            // when the user dismisses the sheet. Don't surface that as an
            // error — resolve null so the caller can silently bail.
            if (isCancelError(e)) return null
            throw e
        }
    }, [])

    return { pickFile, isPopupHandoff: false }
}
