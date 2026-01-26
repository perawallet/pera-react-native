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
import { v7 as uuidv7 } from 'uuid'
import {
    getSeedFromMasterKey,
    AccountTypes,
    type HDWalletAccount,
    discoverAccounts,
} from '@perawallet/wallet-core-accounts'
import { useKMS } from '@perawallet/wallet-core-kms'
import { useAlgorandClient } from '@perawallet/wallet-core-blockchain'
import { OnboardingStackParamList } from '../../routes/types'

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
    const { getPrivateData } = useKMS()
    const algorandClient = useAlgorandClient()

    const onboardingWalletId = account.hdWalletDetails.walletId

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

    const searchAccounts = useCallback(async () => {
        if (!onboardingWalletId) {
            return
        }

        try {
            const privateData = await getPrivateData(onboardingWalletId)

            if (!privateData) {
                return
            }

            const seed = getSeedFromMasterKey(privateData)
            const derivationType = account.hdWalletDetails.derivationType

            const discoveredAccounts = await discoverAccounts({
                seed,
                derivationType,
                accountGapLimit: 5,
                keyIndexGapLimit: 5,
                async checkActivity(address) {
                    try {
                        const accountInfo =
                            await algorandClient.client.algod.accountInformation(
                                address,
                            )
                        return (
                            accountInfo.amount > 0 ||
                            (accountInfo.assets?.length ?? 0) > 0 ||
                            (accountInfo.appsLocalState?.length ?? 0) > 0 ||
                            (accountInfo.appsTotalSchema?.numUints ?? 0) > 0 ||
                            (accountInfo.appsTotalSchema?.numByteSlices ?? 0) >
                                0
                        )
                    } catch {
                        // Algod returns 404 for empty accounts
                        return false
                    }
                },
                // Using defaults for max limits
            })

            const foundAccounts: HDWalletAccount[] = discoveredAccounts.map(
                ({ accountIndex, keyIndex, address }) => ({
                    id: uuidv7(),
                    address,
                    type: AccountTypes.hdWallet,
                    canSign: true,
                    hdWalletDetails: {
                        walletId: onboardingWalletId!,
                        account: accountIndex,
                        change: 0,
                        keyIndex,
                        derivationType,
                    },
                }),
            )

            const finalAccounts = [account, ...foundAccounts]

            navigation.replace('ImportSelectAddresses', {
                accounts: finalAccounts,
            })
        } catch {
            showToast({
                type: 'error',
                title: t('onboarding.import_account.failed_title'),
                body: t('onboarding.import_account.failed_body'),
            })
            navigation.goBack()
        }
    }, [
        onboardingWalletId,
        getPrivateData,
        algorandClient,
        navigation,
        account,
    ])

    useEffect(() => {
        searchAccounts()
    }, [searchAccounts])

    return {
        t,
        dotOpacities,
    }
}
