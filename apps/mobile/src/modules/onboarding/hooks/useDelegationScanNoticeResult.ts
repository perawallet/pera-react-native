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
    chainAccountOf,
    findAddressHolder,
    useAccountDiscovery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    i18nKey,
    LEGACY_CHAIN_ID,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { logger } from '@perawallet/wallet-core-shared'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

export const REKEY_SCAN_UNAVAILABLE = 'rekey-scan-unavailable' as const

/** What ran the scan, which picks the failure notice's wording. */
export type RekeyScanTrigger = 'import' | 'rescan'

const REKEY_SCAN_FAILED_BODY: Record<RekeyScanTrigger, I18nKey> = {
    import: i18nKey('onboarding.searching_accounts.rekey_scan_failed_body'),
    rescan: i18nKey('onboarding.searching_accounts.rekey_rescan_failed_body'),
}

export type UseDelegationScanNoticeResultResult = {
    scanRekeyed: (
        accountAddresses: string[],
        trigger?: RekeyScanTrigger,
    ) => Promise<WalletAccount[] | typeof REKEY_SCAN_UNAVAILABLE>
    /** The addresses `scanRekeyed` takes: each account's on the scan's chain; an account without one is skipped. */
    rekeyScanAddressesOf: (accounts: readonly WalletAccount[]) => string[]
    /** The candidates none of `held` already holds on the scan's chain. */
    withoutHeld: (
        candidates: readonly WalletAccount[],
        held: readonly WalletAccount[],
    ) => WalletAccount[]
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
export const useDelegationScanNoticeResult =
    (): UseDelegationScanNoticeResultResult => {
        const scope = useSelectedScope(LEGACY_CHAIN_ID)
        const { discoverDelegatedAccounts } = useAccountDiscovery(scope)
        const { showToast } = useToast()
        const { t } = useLanguage()

        const scanRekeyed = useCallback(
            async (
                accountAddresses: string[],
                trigger: RekeyScanTrigger = 'import',
            ) => {
                try {
                    return await discoverDelegatedAccounts({ accountAddresses })
                } catch (error) {
                    logger.error('Rekeyed-account scan failed after import', {
                        error,
                    })
                    showToast({
                        type: 'info',
                        title: t(
                            'onboarding.searching_accounts.rekey_scan_failed_title',
                        ),
                        body: t(REKEY_SCAN_FAILED_BODY[trigger]),
                    })
                    return REKEY_SCAN_UNAVAILABLE
                }
            },
            [discoverDelegatedAccounts, showToast, t],
        )

        const rekeyScanAddressesOf = useCallback(
            (accounts: readonly WalletAccount[]) =>
                accounts.flatMap(
                    account =>
                        chainAccountOf(account, scope.chainId)?.address ?? [],
                ),
            [scope.chainId],
        )

        const withoutHeld = useCallback(
            (
                candidates: readonly WalletAccount[],
                held: readonly WalletAccount[],
            ) =>
                candidates.filter(
                    candidate =>
                        findAddressHolder(
                            held,
                            scope,
                            chainAccountOf(candidate, scope.chainId)?.address ??
                                '',
                        ) === undefined,
                ),
            [scope],
        )

        return { scanRekeyed, rekeyScanAddressesOf, withoutHeld }
    }
