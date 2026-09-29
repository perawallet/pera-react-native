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

import { useCallback, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { NoBackupCredentialsError } from '@perawallet/wallet-core-backup'
import { logger } from '@perawallet/wallet-core-shared'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import {
    saveCredentialsFile,
    type CredentialsFileSource,
    type MaybeBackupCredentials,
} from '../storage'

type SaveCredentialsFileVariables = {
    destination: CredentialsFileSource
    credentials: MaybeBackupCredentials
}

type UseSaveCredentialsFileResult = {
    /** Takes the credentials as the caller's store holds them and refuses the
     *  incomplete pair itself, so no caller can write a file with a blank key
     *  under a valid backup id. Resolves once the write settles and never
     *  rejects — failures are reported by the hook. */
    saveCredentials: (
        destination: CredentialsFileSource,
        credentials: MaybeBackupCredentials,
    ) => Promise<void>
    isSaving: boolean
}

export const useSaveCredentialsFile = (): UseSaveCredentialsFileResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { showError } = useErrorToast()

    const { mutateAsync, isPending } = useMutation({
        throwOnError: false,
        mutationFn: async ({
            destination,
            credentials: { salt, backupId },
        }: SaveCredentialsFileVariables) => {
            if (!salt || !backupId) throw new NoBackupCredentialsError()
            return saveCredentialsFile(destination, { salt, backupId })
        },
        onSuccess: result => {
            if (result === 'cancelled') return
            showToast(
                {
                    title: t('cloud_backup.store_credentials.success'),
                    body: '',
                    type: 'success',
                },
                // Lets a dismissing native picker or sign-in sheet clear first.
                { delayLength: 'short' },
            )
        },
        onError: (error, { destination }) => {
            logger.error(
                'useSaveCredentialsFile: failed to store the encryption key',
                { destination, error },
            )
            showError(error, t('cloud_backup.store_credentials.error'))
        },
    })

    // A second tap would otherwise race two pickers or two sign-ins. A ref
    // rather than `isPending`, which only reaches a caller's closure a render
    // later — too late for two taps in the same tick.
    const isSavingRef = useRef(false)

    const saveCredentials = useCallback(
        async (
            destination: CredentialsFileSource,
            credentials: MaybeBackupCredentials,
        ) => {
            if (isSavingRef.current) return
            isSavingRef.current = true
            try {
                // `onError` reports it; callers await completion, not outcome.
                await mutateAsync({ destination, credentials }).catch(
                    () => undefined,
                )
            } finally {
                isSavingRef.current = false
            }
        },
        [mutateAsync],
    )

    return { saveCredentials, isSaving: isPending }
}
