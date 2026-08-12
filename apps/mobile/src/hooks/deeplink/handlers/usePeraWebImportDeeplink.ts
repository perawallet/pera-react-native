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

import { useCallback } from 'react'
import { usePeraWebImportFlowStore } from '@modules/onboarding/hooks'
import { navigateToScreen } from '../navigateToScreen'
import type { LinkSource, PeraWebImportDeeplink } from '../types'

export type PeraWebImportDeeplinkHandler = (params: {
    data: PeraWebImportDeeplink
    source: LinkSource
    replaceCurrentScreen: boolean
}) => void

/**
 * QR-only: scanning a Pera Web "Transfer Accounts" payload stashes the
 * `backupId` + 32-byte secretbox `encryptionKey` in the import-flow store
 * and jumps to the loading screen which kicks off the actual decrypt +
 * account import. Pasted / typed deeplinks intentionally don't trigger
 * this — the QR contains the secret in clear, so accepting it from a
 * non-QR source would let a malicious URL pre-stage an attacker's
 * backup decryption.
 */
export const usePeraWebImportDeeplink = (): PeraWebImportDeeplinkHandler => {
    return useCallback(({ data, source, replaceCurrentScreen }) => {
        if (source !== 'qr') return
        usePeraWebImportFlowStore.getState().setQr({
            backupId: data.backupId,
            encryptionKey: data.encryptionKey,
        })
        navigateToScreen(replaceCurrentScreen, 'AddAccount', {
            screen: 'PeraWebImportLoading',
        })
    }, [])
}
