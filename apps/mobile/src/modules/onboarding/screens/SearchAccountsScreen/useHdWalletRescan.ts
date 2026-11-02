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
    type WalletDiscoveryProgress,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { logger } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { networkListOf } from '@modules/chain-ui'
import {
    REKEY_SCAN_UNAVAILABLE,
    useDelegationScanNoticeResult,
} from '../../hooks'

export type HdWalletRescanOptions = {
    /** Walks only these chains, e.g. the ones an earlier scan couldn't check. */
    chainIds?: ChainId[]
    signal?: AbortSignal
    onProgress?: (progress: WalletDiscoveryProgress) => void
    /** True once the user left the screen; the rescan then navigates nowhere. */
    hasLeft?: () => boolean
}

export type UseHdWalletRescanResult = {
    rescanHdWallet: (
        account: WalletAccount,
        options?: HdWalletRescanOptions,
    ) => Promise<void>
}

/** A persisted seed has no in-memory root key, so each chain derives through the keystore: no unlock beyond the app's own. */
export const useHdWalletRescan = (): UseHdWalletRescanResult => {
    const { t } = useLanguage()
    const { errorToast, showToast } = useToast()
    const navigation = useAppNavigation()
    const { scanRekeyed, rekeyScanAddressesOf, withoutHeld } =
        useDelegationScanNoticeResult()
    const { setSelectedAccountId } = useSelectedAccountId()
    const discoverWalletAccounts = useAccountsStore(
        state => state.discoverWalletAccounts,
    )

    const rescanHdWallet = useCallback(
        async (
            account: WalletAccount,
            {
                chainIds,
                signal,
                onProgress,
                hasLeft,
            }: HdWalletRescanOptions = {},
        ) => {
            try {
                const walletId = seedOf(account)
                if (walletId === undefined) throw new NoHdSeedError(account.id)

                const {
                    accounts: changed,
                    createdAccountIds,
                    coverage,
                    failedChainIds,
                    isCancelled,
                } = await discoverWalletAccounts(walletId, {
                    chainIds,
                    signal,
                    onProgress,
                })
                if (hasLeft?.()) return
                const isUnanswered = coverage === 'unanswered' && !isCancelled
                // Nothing answered and no network to name, so "found nothing"
                // would be a guess. With networks named, the result screen
                // keeps them and their retry, e.g. a retry of ones still down.
                if (isUnanswered && failedChainIds.length === 0) {
                    throw new Error('Wallet discovery got no answer')
                }

                if (!isCancelled && !isUnanswered) {
                    const heldAccounts = getAllAccounts()
                    const addresses = rekeyScanAddressesOf(
                        heldAccounts.filter(held => seedOf(held) === walletId),
                    )
                    const scanned = await scanRekeyed(addresses, 'rescan')
                    if (hasLeft?.()) return
                    // The scan lists every account rekeyed to the wallet, held or not; only the unheld are news.
                    const rekeyed =
                        scanned === REKEY_SCAN_UNAVAILABLE
                            ? []
                            : withoutHeld(scanned, heldAccounts)
                    if (rekeyed.length > 0) {
                        // The rekeyed picker takes the place of the result
                        // screen, so an unfinished scan is said here instead.
                        if (coverage !== 'complete') {
                            showToast({
                                type: 'warning',
                                title: t(
                                    'onboarding.scan_accounts_result.incomplete_title',
                                ),
                                body:
                                    failedChainIds.length > 0
                                        ? t(
                                              'onboarding.scan_accounts_result.failed_networks_body',
                                              {
                                                  networks: networkListOf(
                                                      failedChainIds,
                                                      t,
                                                  ),
                                              },
                                          )
                                        : t(
                                              'onboarding.scan_accounts_result.incomplete_body',
                                          ),
                            })
                        }
                        setSelectedAccountId(account.id)
                        navigation.replace('ImportRekeyedAddresses', {
                            accounts: rekeyed,
                        })
                        return
                    }
                }

                navigation.replace('ScanAccountsResult', {
                    account,
                    changedAccountIds: changed.map(added => added.id),
                    createdAccountIds,
                    failedChainIds,
                    isCancelled,
                    isIncomplete: coverage !== 'complete',
                })
            } catch (error) {
                if (hasLeft?.()) return
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
            errorToast,
            showToast,
            t,
            navigation,
            setSelectedAccountId,
        ],
    )

    return { rescanHdWallet }
}
