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
     * resolves its name and text contents. Resolves `null` when no file comes
     * back; rejects with the original error when reading the picked file
     * fails, so the caller can surface it.
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

/**
 * Native: opens the system document picker via `expo-file-system`. See the
 * `.web.ts` twin — `expo-file-system` has no real browser implementation
 * (its web shim just warns and resolves `undefined`), so the browser build
 * instead drives a hidden `<input type="file">` + `FileReader`.
 */
export const usePickBackupFile = (): UsePickBackupFileResult => {
    const pickFile = useCallback(async (): Promise<PickedBackupFile | null> => {
        // With an options object the picker reports any failure as canceled too.
        const picked = await File.pickFileAsync({ mimeTypes: 'text/plain' })
        if (picked.canceled) return null
        return {
            name: picked.result.name,
            contents: await picked.result.text(),
        }
    }, [])

    return { pickFile, isPopupHandoff: false }
}
