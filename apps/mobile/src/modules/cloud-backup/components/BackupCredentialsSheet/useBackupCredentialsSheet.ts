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
    BackupMnemonicParseError,
    backupIdToAddress,
    useCloudBackupStore,
    withBackupMnemonicIndices,
} from '@perawallet/wallet-core-backup'
import { mnemonicIndexToWord, zeroBytes } from '@perawallet/wallet-core-kms'
import { logger } from '@perawallet/wallet-core-shared'
import { bottomSheetNotifier } from '@components/core'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useClipboard } from '@hooks/useClipboard'

export type BackupCredentialsResult = 'restore'

/**
 * `unavailable` — nothing is stored, so this device isn't configured.
 * `unreadable` — something is stored but can't be decoded; per the backup
 * flow docs (Case 25) the only recovery is re-entering phrase and salt.
 */
export type PassphraseStatus =
    | 'loading'
    | 'ready'
    | 'unavailable'
    | 'unreadable'

type UseBackupCredentialsSheetResult = {
    credentialAddress: string
    encryptionKey: string
    wordIndices: Uint16Array
    passphraseStatus: PassphraseStatus
    handleCopyPassphrase: () => void
    handleCopyEncryptionKey: () => void
    handleRestore: () => void
    handleClose: () => void
}

export const useBackupCredentialsSheet =
    (): UseBackupCredentialsSheetResult => {
        const { copyToClipboard } = useClipboard()
        const { resolve, dismiss } =
            useBottomSheetResult<BackupCredentialsResult>()
        const backupId = useCloudBackupStore(state => state.backupId)
        const salt = useCloudBackupStore(state => state.salt)

        // The buffer is held in a ref as well as state because the unmount wipe
        // has to happen outside React's update queue: a `setState` updater is
        // never invoked on an unmounted component, so zeroing inside one is a
        // no-op exactly when it matters most.
        const bufferRef = useRef<Uint16Array | null>(null)
        const [wordIndices, setWordIndices] = useState<Uint16Array>(
            () => new Uint16Array(),
        )
        const [passphraseStatus, setPassphraseStatus] =
            useState<PassphraseStatus>('loading')

        const credentialAddress = backupId ? backupIdToAddress(backupId) : ''
        const encryptionKey = salt ?? ''

        // Zero the retained index buffer before dropping it so the phrase
        // doesn't linger in memory waiting on GC. The words this replaced could
        // not be wiped: `.fill('')` on a `string[]` only drops the array's
        // references and leaves the strings themselves on the heap. State and
        // ref share one buffer, so this wipes what the grid renders too — the
        // `setWordIndices` below lands in the same synchronous block, so no
        // render observes the zeroed buffer.
        const clearIndices = useCallback(() => {
            zeroBytes(bufferRef.current)
            bufferRef.current = null
            setWordIndices(new Uint16Array())
        }, [])

        useEffect(() => {
            let cancelled = false
            withBackupMnemonicIndices(resolved => {
                // Retain a copy: the accessor zeroes its own buffer once this
                // handler returns.
                if (cancelled) return
                const retained = resolved.slice()
                bufferRef.current = retained
                setWordIndices(retained)
            })
                .then(loaded => {
                    if (cancelled) return
                    // `null` means the accessor never reached the handler:
                    // nothing is stored for this device.
                    setPassphraseStatus(
                        loaded === null ? 'unavailable' : 'ready',
                    )
                })
                .catch(error => {
                    logger.error(
                        'BackupCredentialsSheet: failed to load mnemonic',
                        {
                            error:
                                error instanceof Error
                                    ? error.message
                                    : String(error),
                            isParseError:
                                error instanceof BackupMnemonicParseError,
                        },
                    )
                    clearIndices()
                    if (!cancelled) setPassphraseStatus('unreadable')
                })
            return () => {
                cancelled = true
                clearIndices()
            }
        }, [clearIndices])

        const handleCopyPassphrase = useCallback(() => {
            // Guard the empty buffer: copying '' would wipe whatever the user
            // had on the clipboard and still report success.
            if (wordIndices.length === 0) return
            // The words exist only for the length of this call; the retained
            // form stays the zeroable index buffer.
            // Without the sheet's own notifier the "Copied" toast renders
            // behind the sheet, and it is the only feedback this button gives.
            void copyToClipboard(
                Array.from(wordIndices, index =>
                    mnemonicIndexToWord(index),
                ).join(' '),
                bottomSheetNotifier.current ?? undefined,
            )
        }, [copyToClipboard, wordIndices])

        const handleCopyEncryptionKey = useCallback(() => {
            if (!encryptionKey) return
            void copyToClipboard(
                encryptionKey,
                bottomSheetNotifier.current ?? undefined,
            )
        }, [copyToClipboard, encryptionKey])

        const handleRestore = useCallback(() => resolve('restore'), [resolve])

        const handleClose = useCallback(() => dismiss(), [dismiss])

        return {
            credentialAddress,
            encryptionKey,
            wordIndices,
            passphraseStatus,
            handleCopyPassphrase,
            handleCopyEncryptionKey,
            handleRestore,
            handleClose,
        }
    }
