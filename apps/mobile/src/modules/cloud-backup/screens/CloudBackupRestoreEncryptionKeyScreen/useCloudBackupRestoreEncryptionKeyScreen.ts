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
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    readCloudBackupRestoreMnemonic,
    useCloudBackupRestoreDraftStore,
} from '@perawallet/wallet-core-backup'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import {
    useRestoreCloudBackup,
    type RestoreErrorCategory,
} from '../../hooks/useRestoreCloudBackup'
import type { ImportSummary } from '../../hooks/useCloudBackupImport'
import type { CloudBackupStackParamList } from '../../routes'

type Translate = ReturnType<typeof useLanguage>['t']
type Restore = ReturnType<typeof useRestoreCloudBackup>['restore']

const ERROR_KEYS: Record<RestoreErrorCategory, string> = {
    NOT_FOUND: 'cloud_backup.restore.error_not_found',
    INVALID_CREDENTIALS: 'cloud_backup.restore.error_invalid_credentials',
    UNKNOWN: 'cloud_backup.restore.error_unknown',
}

const outcomeToast = (t: Translate, { failed }: ImportSummary) =>
    failed.length > 0
        ? {
              title: t('cloud_backup.restore.partial_success', {
                  count: failed.length,
              }),
              body: '',
              type: 'warning' as const,
          }
        : {
              title: t('cloud_backup.restore.success'),
              body: '',
              type: 'success' as const,
          }

const failureToast = (t: Translate, category: RestoreErrorCategory) => ({
    title: t(ERROR_KEYS[category]),
    body: '',
    type: 'error' as const,
})

type RestoreDraft = {
    hasMnemonic: boolean
    clearDraft: () => void
}

/**
 * Scrubs the entered recovery phrase on unmount. This is the terminal screen
 * that consumes the mnemonic — and the only screen that populates the draft is
 * the one navigating here — so success reset, back-out and any other flow exit
 * all pass through here. The success path clears it too; doing so is idempotent.
 */
const useRestoreDraft = (): RestoreDraft => {
    const hasMnemonic = useCloudBackupRestoreDraftStore(
        state =>
            state.mnemonicIndices !== null || state.mnemonicRawBytes !== null,
    )
    const clearDraft = useCloudBackupRestoreDraftStore(
        state => state.clearDraft,
    )

    useEffect(() => () => clearDraft(), [clearDraft])

    return { hasMnemonic, clearDraft }
}

type RestoreOutcome = {
    onSuccess: (summary: ImportSummary) => void
    onError: (category: RestoreErrorCategory) => void
}

const useRestoreOutcome = (clearDraft: () => void): RestoreOutcome => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const navigation =
        useNavigation<NativeStackNavigationProp<CloudBackupStackParamList>>()

    const onSuccess = useCallback(
        (summary: ImportSummary) => {
            showToast(outcomeToast(t, summary))
            clearDraft()
            navigation.reset({
                index: 0,
                routes: [{ name: 'CloudBackupOverview' }],
            })
        },
        [showToast, t, clearDraft, navigation],
    )

    const onError = useCallback(
        (category: RestoreErrorCategory) =>
            showToast(failureToast(t, category)),
        [showToast, t],
    )

    return { onSuccess, onError }
}

type RestoreRunner = {
    isRestoring: boolean
    handleRestore: () => Promise<void>
}

const useRestoreRunner = (
    restore: Restore,
    hasMnemonic: boolean,
    salt: string,
): RestoreRunner => {
    const [isRestoring, setIsRestoring] = useState(false)

    const handleRestore = useCallback(async () => {
        if (!hasMnemonic || salt.length === 0) return
        // Words exist only for the length of this call; the retained form
        // stays the zeroable buffer in the draft store.
        const mnemonic = readCloudBackupRestoreMnemonic()
        if (!mnemonic) return

        setIsRestoring(true)
        // Single owner of the flag: `restore` reports outcomes through its
        // callbacks, so anything it throws would otherwise leave the loading
        // overlay — a modal — up with no way to dismiss it.
        try {
            await restore({ mnemonic, salt })
        } finally {
            setIsRestoring(false)
        }
    }, [hasMnemonic, salt, restore])

    return { isRestoring, handleRestore }
}

type UseCloudBackupRestoreEncryptionKeyScreenResult = {
    t: Translate
    encryptionKey: string
    isRestoring: boolean
    canRestore: boolean
    handleKeyChange: (value: string) => void
    handleRestore: () => Promise<void>
}

export const useCloudBackupRestoreEncryptionKeyScreen =
    (): UseCloudBackupRestoreEncryptionKeyScreenResult => {
        const { t } = useLanguage()
        const [encryptionKey, setEncryptionKey] = useState('')
        const { hasMnemonic, clearDraft } = useRestoreDraft()
        const outcome = useRestoreOutcome(clearDraft)
        const { restore } = useRestoreCloudBackup(outcome)
        const { isRestoring, handleRestore } = useRestoreRunner(
            restore,
            hasMnemonic,
            encryptionKey,
        )

        const handleKeyChange = useCallback(
            (value: string) => setEncryptionKey(value.trim()),
            [],
        )

        return {
            t,
            encryptionKey,
            isRestoring,
            canRestore: encryptionKey.length > 0 && !isRestoring,
            handleKeyChange,
            handleRestore,
        }
    }
