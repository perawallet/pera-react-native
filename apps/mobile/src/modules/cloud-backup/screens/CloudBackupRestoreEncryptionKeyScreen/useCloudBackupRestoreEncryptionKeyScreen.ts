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

import { useCallback, useEffect, useRef, useState } from 'react'
import {
    readCloudBackupImportedKey,
    useCloudBackupRestoreDraftStore,
    type BackupEncryptionKey,
    type RestoreCloudBackupVariables,
} from '@perawallet/wallet-core-backup'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { trackEvent, CloudBackupEvent } from '@analytics'
import { useLanguage } from '@hooks/useLanguage'
import { useRequirePinVerification } from '@modules/security'
import {
    useCloudBackupRestoreProgress,
    type UseCloudBackupRestoreProgressResult,
} from '../../hooks/useCloudBackupRestoreProgress'
import { usePrepareCloudBackupRestore } from '../../hooks/usePrepareCloudBackupRestore'

type Translate = ReturnType<typeof useLanguage>['t']

/**
 * Scrubs the entered recovery phrase on unmount. This is where the manual
 * restore flow consumes the mnemonic the passphrase screen wrote, so success,
 * back-out and any other exit from that flow all pass through here. The
 * account choice sits above this screen, so the phrase outlives it until the
 * flow exits.
 */
const useRestoreDraft = (): boolean => {
    const hasMnemonic = useCloudBackupRestoreDraftStore(
        state =>
            state.mnemonicIndices !== null || state.mnemonicRawBytes !== null,
    )
    const clearDraft = useCloudBackupRestoreDraftStore(
        state => state.clearDraft,
    )

    useEffect(() => () => clearDraft(), [clearDraft])

    return hasMnemonic
}

const useRestoreRunner = (
    prepare: (variables: RestoreCloudBackupVariables) => void,
    hasMnemonic: boolean,
    salt: string,
    importedKey: Nullable<BackupEncryptionKey>,
): (() => void) => {
    const { requirePinVerification } = useRequirePinVerification()
    // The PIN sheet takes a moment to mount, and a second tap in that window
    // would open a second one.
    const isStartingRef = useRef(false)

    const start = useCallback(async () => {
        if (!hasMnemonic || salt.length === 0 || isStartingRef.current) return
        isStartingRef.current = true
        try {
            trackEvent(CloudBackupEvent.RestoreEncryptionKeyProceed)
            if (!(await requirePinVerification())) return
            // The file's Argon2id settings belong to its salt; an edited key
            // is restored like a typed one, on this build's defaults.
            prepare(
                salt === importedKey?.salt
                    ? { ...importedKey, credentialsConfirmed: true }
                    : { salt, credentialsConfirmed: true },
            )
        } finally {
            isStartingRef.current = false
        }
    }, [hasMnemonic, salt, importedKey, prepare, requirePinVerification])

    return useCallback(() => void start(), [start])
}

type UseCloudBackupRestoreEncryptionKeyScreenResult = {
    t: Translate
    encryptionKey: string
    isRestoring: boolean
    restoreProgress: UseCloudBackupRestoreProgressResult
    canRestore: boolean
    handleKeyChange: (value: string) => void
    handleRestore: () => void
}

export const useCloudBackupRestoreEncryptionKeyScreen =
    (): UseCloudBackupRestoreEncryptionKeyScreenResult => {
        const { t } = useLanguage()
        // Read once: editing the field must not be undone by a store update,
        // and the draft is written before this screen mounts.
        const [importedKey] = useState(readCloudBackupImportedKey)
        const [encryptionKey, setEncryptionKey] = useState(
            importedKey?.salt ?? '',
        )
        const hasMnemonic = useRestoreDraft()
        const { prepare, isRestoring } = usePrepareCloudBackupRestore()
        const restoreProgress = useCloudBackupRestoreProgress()
        const handleRestore = useRestoreRunner(
            prepare,
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
            restoreProgress,
            canRestore: encryptionKey.length > 0 && !isRestoring,
            handleKeyChange,
            handleRestore,
        }
    }
