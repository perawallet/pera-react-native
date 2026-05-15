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

import { useCallback, useState } from 'react'
import * as Clipboard from 'expo-clipboard'
import { File } from 'expo-file-system'
import {
    AsbErrorReason,
    AsbImportError,
    parseBackupEnvelope,
} from '@perawallet/wallet-core-backup'
import { logger } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useAsbImportFlowStore } from '@modules/onboarding/hooks'

type LoadedFile = {
    name: string
    contents: string
}

type UseAsbImportBackupScreenResult = {
    loadedFile: LoadedFile | null
    canContinue: boolean
    handlePickFile: () => Promise<void>
    handlePasteFromClipboard: () => Promise<void>
    handleClearFile: () => void
    handleContinue: () => void
}

const PASTED_FILE_NAME_KEY = 'onboarding.asb_import.backup.pasted_name'

export const useAsbImportBackupScreen = (): UseAsbImportBackupScreenResult => {
    const navigation = useAppNavigation()
    const { t } = useLanguage()
    const { errorToast } = useToast()
    const setEnvelope = useAsbImportFlowStore(state => state.setEnvelope)

    const [loadedFile, setLoadedFile] = useState<LoadedFile | null>(null)

    const showValidationError = useCallback(
        (reason: AsbErrorReason) => {
            errorToast(
                t('onboarding.asb_import.backup.errors.title'),
                t(`onboarding.asb_import.backup.errors.${reason}` as const),
            )
        },
        [errorToast, t],
    )

    const tryLoad = useCallback(
        (rawContents: string, fileName: string) => {
            try {
                const envelope = parseBackupEnvelope(rawContents)
                setEnvelope(envelope)
                setLoadedFile({ name: fileName, contents: rawContents })
            } catch (e) {
                setLoadedFile(null)
                if (e instanceof AsbImportError) {
                    showValidationError(e.reason)
                } else {
                    logger.error('Unexpected ASB envelope parse error', {
                        error: e,
                    })
                    showValidationError(AsbErrorReason.MalformedEnvelope)
                }
            }
        },
        [setEnvelope, showValidationError],
    )

    const handlePickFile = useCallback(async () => {
        try {
            // `File.pickFileAsync` returns a single `File` when invoked
            // without the multi-select option; the typed return is a union
            // to accommodate the (unused here) multi-pick path.
            const result = await File.pickFileAsync(undefined, 'text/plain')
            const file = Array.isArray(result) ? result[0] : result
            if (!file) return
            const contents = await file.text()
            tryLoad(contents, file.name)
        } catch (e) {
            // The native picker rejects with `FilePickingCancelledException`
            // when the user dismisses the sheet. Don't surface that as an
            // error — silently bail so they can retry.
            const message = String((e as { message?: unknown })?.message ?? '')
            if (/cancel/i.test(message)) return
            logger.error('Failed to read ASB backup file', { error: e })
            errorToast(
                t('onboarding.asb_import.backup.errors.title'),
                t('onboarding.asb_import.backup.errors.read_failed'),
            )
        }
    }, [tryLoad, errorToast, t])

    const handlePasteFromClipboard = useCallback(async () => {
        const text = await Clipboard.getStringAsync()
        if (!text || !text.trim()) {
            errorToast(
                t('onboarding.asb_import.backup.errors.title'),
                t('onboarding.asb_import.backup.errors.empty_clipboard'),
            )
            return
        }
        tryLoad(text, t(PASTED_FILE_NAME_KEY))
    }, [tryLoad, errorToast, t])

    const handleClearFile = useCallback(() => {
        setLoadedFile(null)
    }, [])

    const handleContinue = useCallback(() => {
        if (!loadedFile) return
        navigation.push('AsbImportKey')
    }, [navigation, loadedFile])

    return {
        loadedFile,
        canContinue: loadedFile !== null,
        handlePickFile,
        handlePasteFromClipboard,
        handleClearFile,
        handleContinue,
    }
}
