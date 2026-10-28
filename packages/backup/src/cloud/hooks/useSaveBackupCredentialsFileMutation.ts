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

import { useMutation } from '@tanstack/react-query'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import type {
    CloudFileSaveResult,
    CloudFileStore,
} from '@perawallet/wallet-extension-platform'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { NoBackupCredentialsError } from '../../errors'
import {
    backupCredentialsFileName,
    buildBackupCredentialsFile,
} from '../credentials/backupCredentialsFile'
import type { BackupId } from '../models'

/** A local file alongside the cloud drives the platform can reach. */
export type BackupCredentialsFileDestination = 'device' | CloudFileStore

/** Writes on this device; resolves `'cancelled'` when the user backs out. */
export type SaveBackupCredentialsFileToDevice = (
    fileName: string,
    contents: string,
) => Promise<CloudFileSaveResult>

/** Straight off a store, where either half can be gone: the backup was deleted
 *  or the draft cleared while a sheet, a PIN or a sign-in was open. */
export type SaveBackupCredentialsFileVariables = {
    destination: BackupCredentialsFileDestination
    salt: Nullable<string>
    backupId: Nullable<BackupId>
}

export type UseSaveBackupCredentialsFileMutationParams = {
    /** The on-device save has no platform service, so the app supplies it. */
    saveToDevice: SaveBackupCredentialsFileToDevice
    onSuccess?: (
        result: CloudFileSaveResult,
        variables: SaveBackupCredentialsFileVariables,
    ) => void
    onError?: (
        error: Error,
        variables: SaveBackupCredentialsFileVariables,
    ) => void
}

export type UseSaveBackupCredentialsFileMutationResult = {
    saveCredentialsFile: (
        variables: SaveBackupCredentialsFileVariables,
    ) => Promise<CloudFileSaveResult>
    isPending: boolean
    /** The most recent call's destination; undefined before the first. */
    destination: Optional<BackupCredentialsFileDestination>
}

export const useSaveBackupCredentialsFileMutation = ({
    saveToDevice,
    onSuccess,
    onError,
}: UseSaveBackupCredentialsFileMutationParams): UseSaveBackupCredentialsFileMutationResult => {
    const mutation = useMutation({
        throwOnError: false,
        mutationFn: async ({
            destination,
            salt,
            backupId,
        }: SaveBackupCredentialsFileVariables) => {
            if (!salt || !backupId) throw new NoBackupCredentialsError()

            // Named after the backup, so storing a second one sits beside the
            // first instead of overwriting it.
            const fileName = backupCredentialsFileName(backupId)
            const contents = buildBackupCredentialsFile(salt)

            return destination === 'device'
                ? saveToDevice(fileName, contents)
                : getProvider().cloudFileStorage.save(
                      destination,
                      fileName,
                      contents,
                  )
        },
        onSuccess,
        onError,
    })

    return {
        saveCredentialsFile: mutation.mutateAsync,
        isPending: mutation.isPending,
        destination: mutation.variables?.destination,
    }
}
