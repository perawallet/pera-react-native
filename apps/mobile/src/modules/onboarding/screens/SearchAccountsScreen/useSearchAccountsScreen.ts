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
    chainAccountOf,
    hasCustody,
    hdIndexOf,
    signingKeyOn,
    useHDImportSession,
    useSelectedAccountId,
} from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { OnboardingStackParamList } from '../../routes/types'
import {
    useDelegationScanNoticeResult,
    REKEY_SCAN_UNAVAILABLE,
} from '../../hooks'
import { useHdWalletRescan } from './useHdWalletRescan'

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
    const { errorToast } = useToast()
    const navigation = useAppNavigation()
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const { discoverImportAccounts, cancelImport } = useHDImportSession(scope)
    const { scanRekeyed } = useDelegationScanNoticeResult()
    const { rescanHdWallet } = useHdWalletRescan()
    const { setSelectedAccountId } = useSelectedAccountId()

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

            // Existing mode: `params` is the variant the import branch above
            // ruled out.
            const { account } = params as Extract<
                typeof params,
                { account: unknown }
            >
            if (hdIndexOf(account) !== undefined) {
                await rescanHdWallet(account)
                return
            }

            if (!signingKeyOn(account, scope.chainId)) return
            const accountAddress =
                chainAccountOf(account, scope.chainId)?.address ?? ''

            if (hasCustody(account, 'local')) {
                // Quantum accounts are flat single-key accounts like algo25:
                // discovery is an address-only rekey scan (no derivation), and
                // an empty result must still move the flow on to NameAccount —
                // otherwise the "Searching your accounts" step hangs forever.
                const discoveredRekeyedAccounts = await scanRekeyed([
                    accountAddress,
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
                    setSelectedAccountId(account.id)
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
            // Not showError: an unrecognised error would fall through to generic copy instead of this step's.
            errorToast(
                t('onboarding.import_account.failed_title'),
                t('onboarding.import_account.failed_body'),
            )
            navigation.goBack()
        }
    }, [
        params,
        discoverImportAccounts,
        cancelImport,
        rescanHdWallet,
        scanRekeyed,
        navigation,
        t,
        errorToast,
        setSelectedAccountId,
        scope.chainId,
    ])

    useEffect(() => {
        void searchAccounts()
    }, [searchAccounts])

    return {
        t,
        dotOpacities,
    }
}
