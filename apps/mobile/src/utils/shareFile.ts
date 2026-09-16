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

import { File, Paths } from 'expo-file-system'
import Share from 'react-native-share'

export type ShareFileResult = 'shared' | 'cancelled'

export type ShareFileOptions = {
    mimeType: string
    /** iOS only: opens Save to Files instead of the share sheet. */
    saveToFiles?: boolean
}

const SHARE_CANCELLED_CODE = 'CANCELLED'

export const shareFile = async (
    fileName: string,
    contents: string,
    { mimeType, saveToFiles = false }: ShareFileOptions,
): Promise<ShareFileResult> => {
    const staged = new File(Paths.cache, fileName)
    staged.create({ overwrite: true })
    staged.write(contents)
    try {
        const { success } = await Share.open({
            url: staged.uri,
            filename: fileName,
            type: mimeType,
            saveToFiles,
            failOnCancel: false,
        })
        return success ? 'shared' : 'cancelled'
    } catch (error) {
        // Save to Files rejects on cancel even with failOnCancel off.
        if (
            (error as { code?: unknown } | null)?.code === SHARE_CANCELLED_CODE
        ) {
            return 'cancelled'
        }
        throw error
    } finally {
        // Android resolves once a target app is picked, before it reads the
        // file; only Save to Files has copied it by now.
        if (saveToFiles && staged.exists) staged.delete()
    }
}
