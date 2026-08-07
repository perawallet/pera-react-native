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

import { useCallback, useEffect, useState } from 'react'
import {
    AsbErrorReason,
    AsbImportError,
    parseBackupEnvelope,
} from '@perawallet/wallet-core-backup'
import { logger } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useClipboard } from '@hooks/useClipboard'
import { useAsbImportFlowStore } from '@modules/onboarding/hooks'
import { usePickBackupFile } from './usePickBackupFile'

type LoadedFile = {
    name: string
    contents: string
}

type UseAsbImportBackupScreenResult = {
    loadedFile: LoadedFile | null
    canContinue: boolean
    /** True when picking hands off to a browser tab instead of opening a picker. */
    isPickFileHandoff: boolean
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
    const { readText } = useClipboard()
    const { pickFile, isPopupHandoff } = usePickBackupFile()
    const envelope = useAsbImportFlowStore(state => state.envelope)
    const setEnvelope = useAsbImportFlowStore(state => state.setEnvelope)

    const [loadedFile, setLoadedFile] = useState<LoadedFile | null>(null)

    // Later flow steps (SelectAccounts cleanup, Result Done) wipe the store
    // to zero decrypted material. If the user navigates back into this screen
    // afterwards, the local "loadedFile" card would otherwise still display
    // "Pasted backup", but tapping Next leads to a Key screen with no
    // envelope to decrypt — so it bounces straight back here. Mirror the
    // store: if the envelope disappears, clear the displayed indicator so
    // the user has to re-pick / re-paste.
    useEffect(() => {
        if (!envelope) setLoadedFile(null)
    }, [envelope])

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
            // Resolves `null` when the user dismisses the picker; the
            // native/web implementations handle that cancellation
            // difference internally (see `usePickBackupFile`'s twins).
            const file = await pickFile()
            if (!file) return
            tryLoad(file.contents, file.name)
        } catch (e) {
            logger.error('Failed to read ASB backup file', { error: e })
            errorToast(
                t('onboarding.asb_import.backup.errors.title'),
                t('onboarding.asb_import.backup.errors.read_failed'),
            )
        }
    }, [pickFile, tryLoad, errorToast, t])

    const handlePasteFromClipboard = useCallback(async () => {
        const text = await readText()
        if (!text || !text.trim()) {
            errorToast(
                t('onboarding.asb_import.backup.errors.title'),
                t('onboarding.asb_import.backup.errors.empty_clipboard'),
            )
            return
        }
        tryLoad(text, t(PASTED_FILE_NAME_KEY))
    }, [tryLoad, errorToast, t, readText])

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
        isPickFileHandoff: isPopupHandoff,
        handlePickFile,
        handlePasteFromClipboard,
        handleClearFile,
        handleContinue,
    }
}
