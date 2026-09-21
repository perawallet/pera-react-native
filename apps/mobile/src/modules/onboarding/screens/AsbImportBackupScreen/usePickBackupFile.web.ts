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
import {
    getSurface,
    openExpandedTab,
} from '@perawallet/wallet-extension-platform-chrome'
import { pickTextFile } from '@utils/pickTextFile.web'
import type {
    PickedBackupFile,
    UsePickBackupFileResult,
} from './usePickBackupFile'

/**
 * Web: the pick itself is `pickTextFile`; ASB backup files are base64 text
 * (see `parseBackupEnvelope`), so a text read matches what the native path
 * gets from `File#text()`.
 *
 * Except in the 360x600 toolbar popup, where an OS file dialog kills the
 * surface before it can return. There the hand-off to the expanded tab
 * (`?flow=asb-import`) replaces the pick, same pattern as
 * `useLedgerExpandedTabHandoff` and the QR camera prompt. Pasting the backup
 * text stays available inline either way.
 */
export const usePickBackupFile = (): UsePickBackupFileResult => {
    const isPopupHandoff = getSurface() === 'popup'

    const pickFile = useCallback(async (): Promise<PickedBackupFile | null> => {
        if (isPopupHandoff) {
            void openExpandedTab('asb-import')
            return null
        }
        const picked = await pickTextFile('.txt,text/plain')
        return picked && { name: picked.name, contents: await picked.text() }
    }, [isPopupHandoff])

    return { pickFile, isPopupHandoff }
}
