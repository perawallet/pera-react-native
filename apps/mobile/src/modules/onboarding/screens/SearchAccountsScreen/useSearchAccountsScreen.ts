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

import { useCallback, useEffect, useRef } from 'react'
import { Animated } from 'react-native'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { type RouteProp, useRoute } from '@react-navigation/native'
import {
    useAccountDiscovery,
    useHDImportSession,
    useSelectedAccountAddress,
    useCreateAccount,
    useAllAccounts,
    isHDWalletAccount,
    AccountTypes,
} from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
import { logger } from '@perawallet/wallet-core-shared'
import { type OnboardingStackParamList } from '../../routes/types'
import {
    useExitAccountFlow,
    useRekeyScanNotice,
    REKEY_SCAN_UNAVAILABLE,
} from '../../hooks'

export type UseSearchAccountsScreenResult = {
    t: (key: string) => string
    dotOpacities: Animated.Value[]
}

const DOT_COUNT = 4
const ANIMATION_DURATION = 400
const STEP_DURATION = 500
const TRANSPARENT_OPACITY = 0.3
const FULL_OPACITY = 1

export function useSearchAccountsScreen(): UseSearchAccountsScreenResult {
    const route =
        useRoute<RouteProp<OnboardingStackParamList, 'SearchAccounts'>>()
    const params = route.params
    const { t } = useLanguage()
    const { showToast } = useToast()
    const navigation = useAppNavigation()
    const { discoverAccounts } = useAccountDiscovery()
    const { discoverImportAccounts, cancelImport } = useHDImportSession()
    const { exitAccountFlow } = useExitAccountFlow()
    const { scanRekeyed } = useRekeyScanNotice()
    const { setSelectedAccountAddress } = useSelectedAccountAddress()
    const { buildHdWalletAccount } = useCreateAccount()
    const allAccounts = useAllAccounts()
    const { seedIdOf } = useKMS()

    const dotOpacities = useRef(
        Array.from(
            { length: DOT_COUNT },
            () => new Animated.Value(FULL_OPACITY),
        ),
    ).current

    useEffect(() => {
        let currentIndex = 0

        dotOpacities[0].setValue(TRANSPARENT_OPACITY)

        const interval = setInterval(() => {
            const prevIndex = currentIndex
            currentIndex = (currentIndex + 1) % DOT_COUNT

            Animated.parallel([
                Animated.timing(dotOpacities[prevIndex], {
                    toValue: FULL_OPACITY,
                    duration: ANIMATION_DURATION,
                    useNativeDriver: true,
                }),
                Animated.timing(dotOpacities[currentIndex], {
                    toValue: TRANSPARENT_OPACITY,
                    duration: ANIMATION_DURATION,
                    useNativeDriver: true,
                }),
            ]).start()
        }, STEP_DURATION)

        return () => clearInterval(interval)
    }, [dotOpacities])

    const hasSearched = useRef(false)

    const searchAccounts = useCallback(async () => {
        if (hasSearched.current) return
        hasSearched.current = true

        try {
            // Import mode: in-memory rootKey only, nothing persisted yet.
            // Always navigate to selection screen so the user picks the
            // address(es) to actually import.
            if ('mode' in params && params.mode === 'import') {
                const discovered = await discoverImportAccounts({
                    walletKeyId: params.walletKeyId,
                })
                if (discovered.length === 0) {
                    throw new Error('HD discovery returned no accounts')
                }
                navigation.replace('ImportSelectAddresses', {
                    mode: 'import',
                    walletKeyId: params.walletKeyId,
                    accounts: discovered,
                })
                return
            }

            // Existing mode: an account already exists; we may auto-select it
            // if discovery returns only the master, or open the selection
            // screen if multiple accounts have on-chain history.
            // We narrow the discriminated union via the `mode === 'import'`
            // branch above; here `params` is the existing-mode variant.
            const existingParams = params as Extract<
                typeof params,
                { account: unknown }
            >
            const account = existingParams.account
            const createIfEmpty = existingParams.createIfEmpty
            const notifyOnEmpty = existingParams.notifyOnEmpty
            // account.keyPairId is the derived child id; discovery
            // operates against the bip39 seed parent. For algo25 the
            // rekey scan goes through the address-only path and never
            // actually derives, so its walletKeyId is just a label —
            // we fall back to the keyPairId itself when the kms
            // reactive map hasn't observed the freshly-committed seed
            // yet (race between createAlgo25Key and useKeystoreKeys
            // re-render).
            const walletKeyId = seedIdOf(account.keyPairId) ?? account.keyPairId
            if (!walletKeyId) return

            if (account.type === AccountTypes.hdWallet) {
                const derivationType = account.hdWalletDetails.derivationType

                const discoveredAccounts = await discoverAccounts({
                    walletKeyId,
                    derivationType,
                })

                if (!discoveredAccounts) return

                if (discoveredAccounts.length === 1) {
                    if (createIfEmpty) {
                        const walletAccounts = allAccounts
                            .filter(isHDWalletAccount)
                            .filter(a => a.keyPairId === account.keyPairId)
                        const nextKeyIndex =
                            walletAccounts.length > 0
                                ? Math.max(
                                      ...walletAccounts.map(
                                          a => a.hdWalletDetails.keyIndex,
                                      ),
                                  ) + 1
                                : 0

                        const newAccount = await buildHdWalletAccount({
                            walletId: account.keyPairId,
                            account: 0,
                            keyIndex: nextKeyIndex,
                        })

                        navigation.replace('NameAccount', {
                            account: newAccount,
                        })
                    } else {
                        setSelectedAccountAddress(account.address)

                        const rekeyedAccounts = await scanRekeyed([
                            account.address,
                        ])

                        if (
                            rekeyedAccounts !== REKEY_SCAN_UNAVAILABLE &&
                            rekeyedAccounts.length > 0
                        ) {
                            navigation.replace('ImportRekeyedAddresses', {
                                accounts: rekeyedAccounts,
                            })
                        } else {
                            // Don't claim "no new addresses" when the scan
                            // itself failed — scanRekeyed already said so.
                            if (
                                notifyOnEmpty &&
                                rekeyedAccounts !== REKEY_SCAN_UNAVAILABLE
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
                            exitAccountFlow()
                        }
                    }
                } else {
                    navigation.replace('ImportSelectAddresses', {
                        accounts: discoveredAccounts,
                    })
                }
            } else if (
                account.type === AccountTypes.algo25 ||
                account.type === AccountTypes.quantum
            ) {
                // Quantum accounts are flat single-key accounts like algo25:
                // discovery is an address-only rekey scan (no derivation), and
                // an empty result must still move the flow on to NameAccount —
                // otherwise the "Searching your accounts" step hangs forever.
                const discoveredRekeyedAccounts = await scanRekeyed([
                    account.address,
                ])

                // A scan we couldn't run is not a failed import — the account
                // is already committed. Name it and let the user rescan later.
                if (
                    discoveredRekeyedAccounts === REKEY_SCAN_UNAVAILABLE ||
                    discoveredRekeyedAccounts.length === 0
                ) {
                    // Let the user name the imported account before finishing;
                    // NameAccount selects it, plays the confetti and exits the
                    // flow on confirm.
                    navigation.replace('NameAccount', { account })
                } else {
                    setSelectedAccountAddress(account.address)
                    navigation.replace('ImportRekeyedAddresses', {
                        accounts: discoveredRekeyedAccounts,
                    })
                }
            }
        } catch (error) {
            logger.error('Failed during scan-new-addresses', { error })
            // In import mode, abandon the in-memory session so we don't leak
            // root key material if the user retries.
            if ('mode' in params && params.mode === 'import') {
                cancelImport()
            }
            // guardrails-ignore-next-line no-error-toast-in-catch reason: localized import_account.failed_body preserved; raw error not surfaced to user
            showToast({
                type: 'error',
                title: t('onboarding.import_account.failed_title'),
                body: t('onboarding.import_account.failed_body'),
            })
            navigation.goBack()
        }
    }, [
        params,
        discoverAccounts,
        discoverImportAccounts,
        cancelImport,
        scanRekeyed,
        navigation,
        t,
        showToast,
        exitAccountFlow,
        setSelectedAccountAddress,
        buildHdWalletAccount,
        allAccounts,
        seedIdOf,
    ])

    useEffect(() => {
        void searchAccounts()
    }, [searchAccounts])

    return {
        t,
        dotOpacities,
    }
}
