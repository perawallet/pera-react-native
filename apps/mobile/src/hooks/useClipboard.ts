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

import { useToast } from './toast'
import { useLanguage } from '@hooks/useLanguage'
import Clipboard from '@react-native-clipboard/clipboard'
import { useCallback } from 'react'

export const useClipboard = () => {
    const { showToast } = useToast()
    const { t } = useLanguage()

    const copyToClipboard = useCallback(
        (text: string) => {
            Clipboard.setString(text)
            showToast({
                title: t('common.copied_to_clipboard.title'),
                body: t('common.copied_to_clipboard.body'),
                type: 'success',
            })
        },
        [showToast, t],
    )

    return {
        copyToClipboard,
    }
}
