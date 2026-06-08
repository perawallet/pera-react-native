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

import { useToast } from './useToast'
import { useLanguage } from '@hooks/useLanguage'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { useCallback } from 'react'
import type { NotifierRoot } from 'react-native-notifier'

type UseClipboardResult = {
    copyToClipboard: (text: string, notifier?: NotifierRoot) => Promise<void>
    readText: () => Promise<string>
}

export const useClipboard = (): UseClipboardResult => {
    const { showToast } = useToast()
    const { t } = useLanguage()

    const copyToClipboard = useCallback(
        async (text: string, notifier?: NotifierRoot) => {
            await Clipboard.setStringAsync(text)
            void Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
            )
            showToast(
                {
                    title: t('common.copied_to_clipboard.title'),
                    body: t('common.copied_to_clipboard.body'),
                    type: 'success',
                },
                {
                    notifier: notifier,
                },
            )
        },
        [showToast, t],
    )

    const readText = useCallback(async (): Promise<string> => {
        return Clipboard.getStringAsync()
    }, [])

    return {
        copyToClipboard,
        readText,
    }
}
