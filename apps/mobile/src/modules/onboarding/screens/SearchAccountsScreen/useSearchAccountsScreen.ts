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

import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated } from 'react-native'
import { useLanguage } from '@hooks/useLanguage'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { RouteProp, useRoute } from '@react-navigation/native'
import { v7 as uuidv7 } from 'uuid'
import {
    useHDWallet,
    getSeedFromMasterKey,
    AccountTypes,
    type WalletAccount,
    type HDWalletAccount,
} from '@perawallet/wallet-core-accounts'
import { BIP32DerivationType } from '@algorandfoundation/xhd-wallet-api'
import { useKMS } from '@perawallet/wallet-core-kms'
import {
    useAlgorandClient,
    encodeAlgorandAddress,
} from '@perawallet/wallet-core-blockchain'
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

const MAX_ACCOUNT_GAP = 5
const MAX_KEY_INDEX_GAP = 5
const MAX_SEARCH_DEPTH = 20

export function useSearchAccountsScreen(): UseSearchAccountsScreenResult {
    const {
        params: { account },
    } = useRoute<RouteProp<OnboardingStackParamList, 'SearchAccounts'>>()
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const { getPrivateData } = useKMS()
    const { deriveAccountAddress } = useHDWallet()
    const algorandClient = useAlgorandClient()

    const onboardingWalletId = account.hdWalletDetails.walletId;

    const dotOpacities = useRef(
        Array.from({ length: DOT_COUNT }, () => new Animated.Value(FULL_OPACITY)),
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
            const foundAccounts: HDWalletAccount[] = [account]

            let accountGap = 0

            for (
                let accountIndex = 0;
                accountIndex < MAX_SEARCH_DEPTH;
                accountIndex++
            ) {
                if (accountGap >= MAX_ACCOUNT_GAP) {
                    break
                }

                let keyIndexGap = 0
                let accountHasActivity = false

                for (
                    let keyIndex = 0;
                    keyIndex < MAX_SEARCH_DEPTH;
                    keyIndex++
                ) {
                    if (keyIndexGap >= MAX_KEY_INDEX_GAP) {
                        break
                    }

                    // Skip 0/0 as it was already imported in the previous step
                    if (accountIndex === 0 && keyIndex === 0) {
                        keyIndexGap = 0
                        continue
                    }

                    const { address } = await deriveAccountAddress({
                        seed,
                        account: accountIndex,
                        keyIndex,
                    })

                    const encodedAddress = encodeAlgorandAddress(address)
                    const accountInfo =
                        await algorandClient.client.algod.accountInformation(encodedAddress)

                    const hasActivity =
                        accountInfo.amount > 0 ||
                        (accountInfo.assets && accountInfo.assets.length > 0) ||
                        (accountInfo.appsLocalState &&
                            accountInfo.appsLocalState.length > 0) ||
                        (accountInfo.appsTotalSchema &&
                            ((accountInfo.appsTotalSchema.numUints ?? 0) > 0 ||
                                (accountInfo.appsTotalSchema.numByteSlices ?? 0) > 0))

                    if (hasActivity) {
                        accountHasActivity = true
                        keyIndexGap = 0

                        const newAccount: WalletAccount = {
                            id: uuidv7(),
                            address: encodedAddress,
                            type: AccountTypes.hdWallet,
                            canSign: true,
                            hdWalletDetails: {
                                walletId: onboardingWalletId!,
                                account: accountIndex,
                                change: 0,
                                keyIndex,
                                derivationType: BIP32DerivationType.Peikert,
                            },
                        }

                        foundAccounts.push(newAccount)
                    } else {
                        keyIndexGap++
                    }
                }

                if (accountHasActivity) {
                    accountGap = 0
                } else {
                    // We only count an account as "empty" if even its 0th key index is empty
                    // This matches the typical discovery logic
                    accountGap++
                }
            }

            navigation.replace('ImportSelectAddresses', { accounts: foundAccounts })
        } catch {
            // Error handling could be added here (e.g. show toast)
            // For now we just stop searching
        }
    }, [
        onboardingWalletId,
        getPrivateData,
        deriveAccountAddress,
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
        isSearching,
    }
}

