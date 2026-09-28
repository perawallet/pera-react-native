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
import {
    resolveImportAccountType,
    setPendingImportMnemonic,
} from '@perawallet/wallet-core-accounts'
import { navigateToScreen } from '../navigateToScreen'
import { useDeeplinkErrorHandler } from './useDeeplinkErrorHandler'
import type { LinkSource } from '../types'

export type RecoverAddressDeeplinkHandler = (params: {
    mnemonic: string
    source: LinkSource
    replaceCurrentScreen: boolean
}) => Promise<void>

/**
 * Normalize the mnemonic field carried by a recover-address deeplink: native
 * pera QR generators emit comma-separated words (e.g.
 * `?mnemonic=word1,word2,...`), but resolveImportAccountType / the import
 * flow expects whitespace-separated. Normalize commas + extra whitespace
 * here so both shapes work.
 */
const normalizeMnemonic = (raw: string): string =>
    raw.replace(/[,\s]+/g, ' ').trim()

/**
 * QR-only: scanning a recover-address mnemonic opens the Import screen with the
 * passphrase pre-filled so the user reviews/confirms the words (and later names
 * the account) before importing — it no longer imports silently. Pasted/typed
 * deeplinks intentionally don't trigger this — guards against a malicious URL
 * stealing keys.
 */
export const useRecoverAddressDeeplink = (): RecoverAddressDeeplinkHandler => {
    const showError = useDeeplinkErrorHandler()

    return useCallback(
        ({ mnemonic, source, replaceCurrentScreen }) => {
            if (source !== 'qr') return Promise.resolve()

            const normalized = normalizeMnemonic(mnemonic)
            const resolved = resolveImportAccountType(normalized)
            if (!resolved.success) {
                showError({
                    variant: 'recover',
                    parsedType: 'RECOVER_ADDRESS',
                    error: 'Invalid mnemonic length (need 24 or 25 words)',
                })
                return Promise.resolve()
            }

            // Hand the mnemonic to the Import screen via an in-memory store
            // rather than a navigation route param, so the secret never enters
            // the navigation state tree.
            setPendingImportMnemonic(normalized)
            navigateToScreen(replaceCurrentScreen, 'AddAccount', {
                screen: 'ImportAccount',
                params: {
                    accountType: resolved.accountType,
                },
            })

            return Promise.resolve()
        },
        [showError],
    )
}
