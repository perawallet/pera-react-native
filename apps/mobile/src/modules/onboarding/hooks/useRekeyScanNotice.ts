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
    useAccountDiscovery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

export const REKEY_SCAN_UNAVAILABLE = 'rekey-scan-unavailable' as const

export type UseRekeyScanNoticeResult = {
    scanRekeyed: (
        accountAddresses: string[],
    ) => Promise<WalletAccount[] | typeof REKEY_SCAN_UNAVAILABLE>
}

/**
 * Runs the auth-addr scan that follows an import, converting a failure into a
 * non-fatal notice.
 *
 * The account is already committed by the time this runs, so a network failure
 * here must not be reported as a failed import — the user would be told the
 * import failed while holding the account, and their retry would then say
 * "already added".
 */
export const useRekeyScanNotice = (): UseRekeyScanNoticeResult => {
    const { discoverRekeyedAccounts } = useAccountDiscovery()
    const { showToast } = useToast()
    const { t } = useLanguage()

    const scanRekeyed = useCallback(
        async (accountAddresses: string[]) => {
            try {
                return await discoverRekeyedAccounts({ accountAddresses })
            } catch (error) {
                logger.error('Rekeyed-account scan failed after import', {
                    error,
                })
                showToast({
                    type: 'info',
                    title: t(
                        'onboarding.searching_accounts.rekey_scan_failed_title',
                    ),
                    body: t(
                        'onboarding.searching_accounts.rekey_scan_failed_body',
                    ),
                })
                return REKEY_SCAN_UNAVAILABLE
            }
        },
        [discoverRekeyedAccounts, showToast, t],
    )

    return { scanRekeyed }
}
