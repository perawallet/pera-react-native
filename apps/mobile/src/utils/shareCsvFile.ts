/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { Platform, Share } from 'react-native'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { CSV_MIME_TYPE } from '@perawallet/wallet-core-transactions'

export const shareCsvFile = async (
    filename: string,
    csvContent: string,
): Promise<void> => {
    const file = new File(Paths.cache, filename)
    file.create({ overwrite: true })
    file.write(csvContent)

    if (Platform.OS === 'ios') {
        await Share.share({ url: file.uri, title: filename })
        return
    }

    if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this device')
    }

    await Sharing.shareAsync(file.uri, {
        mimeType: CSV_MIME_TYPE,
        dialogTitle: filename,
        UTI: 'public.comma-separated-values-text',
    })
}
