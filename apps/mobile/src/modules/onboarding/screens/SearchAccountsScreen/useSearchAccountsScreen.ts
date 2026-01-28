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

import { useCallback, useEffect, useRef } from 'react'
import { Animated } from 'react-native'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useToast } from '@hooks/useToast'
import { RouteProp, useRoute } from '@react-navigation/native'
import {
    useAccountDiscovery,
    AccountTypes,
    isHDWalletAccount,
    DerivationTypes,
} from '@perawallet/wallet-core-accounts'
import { OnboardingStackParamList } from '../../routes/types'
import { useIsOnboarding } from '../../hooks'

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
    const {
        params: { account },
    } = useRoute<RouteProp<OnboardingStackParamList, 'SearchAccounts'>>()
    const { t } = useLanguage()
    const { showToast } = useToast()
    const navigation = useAppNavigation()
    const { discoverAccounts, discoverRekeyedAccounts } = useAccountDiscovery()
    const { setIsOnboarding } = useIsOnboarding()

    const walletId = isHDWalletAccount(account)
        ? account.hdWalletDetails.walletId
        : account.keyPairId

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
        if (!walletId || hasSearched.current) {
            return
        }

        hasSearched.current = true

        try {
            if (account.type === AccountTypes.hdWallet) {
                const derivationType = account.hdWalletDetails.derivationType

                const discoveredAccounts = await discoverAccounts({
                    walletId,
                    derivationType,
                })

                if (!discoveredAccounts) return

                // Only the master account was found, skip the selection screen
                if (discoveredAccounts.length === 1) {
                    setIsOnboarding(false)
                } else {
                    navigation.replace('ImportSelectAddresses', {
                        accounts: discoveredAccounts,
                    })
                }
            } else if (account.type === AccountTypes.algo25) {
                const discoveredRekeyedAccounts = await discoverRekeyedAccounts({
                    walletId,
                    derivationType: DerivationTypes.Peikert,
                    accountAddresses: [account.address],
                })

                if (!discoveredRekeyedAccounts) return

                if (discoveredRekeyedAccounts.length === 0) {
                    setIsOnboarding(false)
                } else {
                    navigation.replace('ImportRekeyedAddresses', {
                        accounts: discoveredRekeyedAccounts,
                    })
                }
            }
        } catch {
            showToast({
                type: 'error',
                title: t('onboarding.import_account.failed_title'),
                body: t('onboarding.import_account.failed_body'),
            })
            navigation.goBack()
        }
    }, [
        walletId,
        discoverAccounts,
        discoverRekeyedAccounts,
        navigation,
        account,
        t,
        showToast,
        setIsOnboarding,
    ])

    useEffect(() => {
        searchAccounts()
    }, [searchAccounts])

    return {
        t,
        dotOpacities,
    }
}
