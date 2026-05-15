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

import { useCallback } from 'react'
import {
    resolveImportAccountType,
    useImportAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'
import { logger } from '@perawallet/wallet-core-shared'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { navigateToScreen } from '../navigateToScreen'

type LinkSource = 'qr' | 'deeplink'

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
 * QR-only: scanning a recover-address mnemonic kicks off the import flow and
 * lands the user on SearchAccounts so they can finish onboarding the new
 * account. Pasted/typed deeplinks intentionally don't trigger this — guards
 * against a malicious URL stealing keys.
 */
export const useRecoverAddressDeeplink = (): RecoverAddressDeeplinkHandler => {
    const importAccount = useImportAccount()
    const markBackupComplete = useMarkMnemonicBackupComplete()
    const { errorToast } = useToast()
    const { t } = useLanguage()

    return useCallback(
        async ({ mnemonic, source, replaceCurrentScreen }) => {
            if (source !== 'qr') return

            const normalized = normalizeMnemonic(mnemonic)
            const resolved = resolveImportAccountType(normalized)
            if (!resolved.success) {
                logger.warn('Recover address: unrecognised mnemonic length', {
                    wordCount: 'wordCount' in resolved ? resolved.wordCount : 0,
                })
                errorToast(
                    t('errors.deeplink.invalid_url_title'),
                    t('errors.deeplink.invalid_url_body'),
                )
                return
            }

            try {
                const result = await importAccount({
                    mnemonic: normalized,
                    type: resolved.accountType,
                })

                if (result.type === 'hdWallet' && 'walletKeyId' in result) {
                    navigateToScreen(replaceCurrentScreen, 'AddAccount', {
                        screen: 'SearchAccounts',
                        params: {
                            mode: 'import',
                            walletKeyId: result.walletKeyId,
                            derivationType: result.derivationType,
                        },
                    })
                } else {
                    markBackupComplete(result as WalletAccount)
                    navigateToScreen(replaceCurrentScreen, 'AddAccount', {
                        screen: 'SearchAccounts',
                        params: {
                            account: result as WalletAccount,
                        },
                    })
                }
            } catch (error) {
                logger.error('Deeplink import failed', { error })
                // guardrails-ignore-next-line no-error-toast-in-catch reason: deeplink import failure must surface to the user
                errorToast(
                    t('errors.deeplink.invalid_url_title'),
                    t('errors.deeplink.invalid_url_body'),
                )
            }
        },
        [errorToast, importAccount, markBackupComplete, t],
    )
}
