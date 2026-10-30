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
    getAllAccounts,
    NoHdSeedError,
    seedOf,
    useAccountsStore,
    useSelectedAccountId,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import {
    REKEY_SCAN_UNAVAILABLE,
    useDelegationScanNoticeResult,
    useExitAccountFlow,
} from '../../hooks'

export type UseHdWalletRescanResult = {
    rescanHdWallet: (account: WalletAccount) => Promise<void>
}

/** A persisted seed has no in-memory root key, so each chain derives through the keystore: no unlock beyond the app's own. */
export const useHdWalletRescan = (): UseHdWalletRescanResult => {
    const { t } = useLanguage()
    const { showToast, errorToast } = useToast()
    const navigation = useAppNavigation()
    const { exitAccountFlow } = useExitAccountFlow()
    const { scanRekeyed, rekeyScanAddressesOf, withoutHeld } =
        useDelegationScanNoticeResult()
    const { setSelectedAccountId } = useSelectedAccountId()
    const discoverWalletAccounts = useAccountsStore(
        state => state.discoverWalletAccounts,
    )

    const rescanHdWallet = useCallback(
        async (account: WalletAccount) => {
            try {
                const walletId = seedOf(account)
                if (walletId === undefined) throw new NoHdSeedError(account.id)

                const { accounts: changed, coverage } =
                    await discoverWalletAccounts(walletId)
                // Nothing answered, so "found nothing" would be a guess.
                if (coverage === 'unanswered') {
                    throw new Error('Wallet discovery got no answer')
                }

                const heldAccounts = getAllAccounts()
                const addresses = rekeyScanAddressesOf(
                    heldAccounts.filter(held => seedOf(held) === walletId),
                )
                const scanned = await scanRekeyed(addresses, 'rescan')
                // The scan lists every account rekeyed to the wallet, held or not; only the unheld are news.
                const rekeyed =
                    scanned === REKEY_SCAN_UNAVAILABLE
                        ? scanned
                        : withoutHeld(scanned, heldAccounts)

                if (coverage === 'partial') {
                    showToast({
                        type: 'warning',
                        title: t(
                            'onboarding.searching_accounts.rescan_partial_title',
                        ),
                        body: t(
                            'onboarding.searching_accounts.rescan_partial_body',
                        ),
                    })
                } else if (changed.length > 0) {
                    showToast({
                        type: 'success',
                        title: t(
                            'onboarding.searching_accounts.rescan_found_title',
                        ),
                        body: t(
                            'onboarding.searching_accounts.rescan_found_body',
                            { count: changed.length },
                        ),
                    })
                } else if (
                    rekeyed !== REKEY_SCAN_UNAVAILABLE &&
                    rekeyed.length === 0
                ) {
                    showToast({
                        type: 'info',
                        title: t(
                            'onboarding.searching_accounts.no_new_addresses_title',
                        ),
                        body: t(
                            'onboarding.searching_accounts.no_new_addresses_body',
                        ),
                    })
                }

                if (rekeyed !== REKEY_SCAN_UNAVAILABLE && rekeyed.length > 0) {
                    setSelectedAccountId(account.id)
                    navigation.replace('ImportRekeyedAddresses', {
                        accounts: rekeyed,
                    })
                    return
                }
                exitAccountFlow()
            } catch (error) {
                logger.error('Failed during wallet rescan', { error })
                errorToast(
                    t('onboarding.searching_accounts.rescan_failed_title'),
                    t('onboarding.searching_accounts.rescan_failed_body'),
                )
                navigation.goBack()
            }
        },
        [
            discoverWalletAccounts,
            scanRekeyed,
            rekeyScanAddressesOf,
            withoutHeld,
            showToast,
            errorToast,
            t,
            navigation,
            exitAccountFlow,
            setSelectedAccountId,
        ],
    )

    return { rescanHdWallet }
}
