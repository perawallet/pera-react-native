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

import { Directory } from 'expo-file-system'
import { isFilePickerCancellation } from '@utils/isFilePickerCancellation'
import { shareFile } from '@utils/shareFile'
import { isAndroid } from '@utils/platform'

import type { SaveResult } from './types'

const JSON_MIME_TYPE = 'application/json'

const saveOnAndroid = async (
    fileName: string,
    contents: string,
): Promise<SaveResult> => {
    let directory: Directory
    try {
        directory = await Directory.pickDirectoryAsync()
    } catch (error) {
        if (isFilePickerCancellation(error)) return 'cancelled'
        throw error
    }
    directory.createFile(fileName, JSON_MIME_TYPE).write(contents)
    return 'saved'
}

// A copy in the app's own container is deleted with the app, so iOS hands the
// file to Save to Files instead.
const saveOnIos = async (
    fileName: string,
    contents: string,
): Promise<SaveResult> => {
    const result = await shareFile(fileName, contents, {
        mimeType: JSON_MIME_TYPE,
        saveToFiles: true,
    })
    return result === 'shared' ? 'saved' : 'cancelled'
}

export const saveToDevice = (
    fileName: string,
    contents: string,
): Promise<SaveResult> =>
    isAndroid()
        ? saveOnAndroid(fileName, contents)
        : saveOnIos(fileName, contents)
