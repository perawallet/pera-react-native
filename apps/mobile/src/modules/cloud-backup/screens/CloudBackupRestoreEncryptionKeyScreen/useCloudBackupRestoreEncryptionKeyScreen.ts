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
    useCloudBackupRestoreDraftStore,
    useRestoreCloudBackupMutation,
    type BackupEncryptionKey,
    type RestoreCloudBackupVariables,
} from '@perawallet/wallet-core-backup'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { trackEvent, CloudBackupEvent } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import { useRestoreOutcome } from '../../hooks/useRestoreOutcome'

type Translate = ReturnType<typeof useLanguage>['t']

type RestoreDraft = {
    hasMnemonic: boolean
    clearDraft: () => void
}

/**
 * Scrubs the entered recovery phrase on unmount. This is where the manual
 * restore flow consumes the mnemonic the passphrase screen wrote, so success,
 * back-out and any other exit from that flow all pass through here. The success
 * path clears it too; doing so is idempotent.
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

const useRestoreRunner = (
    restore: (variables: RestoreCloudBackupVariables) => void,
    hasMnemonic: boolean,
    salt: string,
    importedKey: Nullable<BackupEncryptionKey>,
): (() => void) =>
    useCallback(() => {
        if (!hasMnemonic || salt.length === 0) return
        trackEvent(CloudBackupEvent.RestoreEncryptionKeyProceed)
        // The file's Argon2id settings belong to its salt; an edited key is
        // restored like a typed one, on this build's defaults.
        restore(salt === importedKey?.salt ? importedKey : { salt })
    }, [hasMnemonic, salt, importedKey, restore])

export type UseCloudBackupRestoreEncryptionKeyScreenParams = {
    onDone: () => void
}

type UseCloudBackupRestoreEncryptionKeyScreenResult = {
    t: Translate
    encryptionKey: string
    isRestoring: boolean
    canRestore: boolean
    handleKeyChange: (value: string) => void
    handleRestore: () => void
}

export const useCloudBackupRestoreEncryptionKeyScreen = ({
    onDone,
}: UseCloudBackupRestoreEncryptionKeyScreenParams): UseCloudBackupRestoreEncryptionKeyScreenResult => {
    const { t } = useLanguage()
    // Read once: editing the field must not be undone by a store update, and
    // the draft is written before this screen mounts.
    const [importedKey] = useState(
        () => useCloudBackupRestoreDraftStore.getState().importedKey,
    )
    const [encryptionKey, setEncryptionKey] = useState(importedKey?.salt ?? '')
    const { hasMnemonic, clearDraft } = useRestoreDraft()
    const outcome = useRestoreOutcome({ clearDraft, onDone })
    const mutation = useRestoreCloudBackupMutation(outcome)
    const isRestoring = mutation.isPending
    const handleRestore = useRestoreRunner(
        mutation.mutate,
        hasMnemonic,
        encryptionKey,
        importedKey,
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
