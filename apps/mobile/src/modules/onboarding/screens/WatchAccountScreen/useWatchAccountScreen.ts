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

import { useCallback, useRef, useState } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import { useAppNavigation } from '@hooks/useAppNavigation'
import {
    useAccountsStore,
    useAllAccounts,
    findAccountByAddressOn,
    preferDefaultChain,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    type ChainId,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import { trackEvent, OnboardingEvent, AnalyticsMetadataKey } from '@analytics'
import { useErrorToast } from '@hooks/useErrorToast'
import { useIsMounted } from '@hooks/useIsMounted'
import { useLanguage } from '@hooks/useLanguage'
import { useNfdResolve } from '@hooks/useNfdResolve'
import { useCapableChainId } from '@hooks/useCapableChainIds'
import { useWatchableChainIds } from '@modules/onboarding/hooks'
import { watchAccountCopyFor } from '@modules/onboarding/utils/watchAccountCopyFor'
import type { AddAccountStackParamList } from '@modules/onboarding/routes/types'

type UseWatchAccountScreenResult = {
    address: string
    /** The chains an address can be watched on, for the field's scanner. */
    watchableChainIds: readonly ChainId[]
    resolvedAddress: string
    descriptionKey: I18nKey
    invalidAddressKey: I18nKey
    isValidAddress: boolean
    isDuplicateAddress: boolean
    isNfdResolved: boolean
    isNfdResolving: boolean
    nfdName: Optional<string>
    handleAddressChange: (text: string) => void
    handleWatchAccount: () => void
}

export const useWatchAccountScreen = (): UseWatchAccountScreenResult => {
    const navigation = useAppNavigation()
    const route =
        useRoute<RouteProp<AddAccountStackParamList, 'WatchAccount'>>()
    const accounts = useAllAccounts()
    const importWatchAccount = useAccountsStore(
        state => state.importWatchAccount,
    )
    const { showError } = useErrorToast()
    const { t } = useLanguage()
    const isMounted = useIsMounted()
    // The import probes the address's other chains, so a second tap can land
    // before it settles.
    const isWatchingRef = useRef(false)
    const [address, setAddress] = useState(route.params?.prefillAddress ?? '')

    const nameChainId = useCapableChainId('nameService')
    const nameChainScope = useSelectedScope(nameChainId)
    const { resolvedAddress, isNfdResolved, isNfdResolving, nfdName } =
        useNfdResolve(address, nameChainScope)

    const watchableChainIds = useWatchableChainIds()
    // The default chain decides when several chains accept the same address.
    const watchChainId = preferDefaultChain(
        watchableChainIds.filter(chainId =>
            addressCodecs.get(chainId).isValid(resolvedAddress),
        ),
    )

    const { descriptionKey, invalidAddressKey } =
        watchAccountCopyFor(watchableChainIds)
    const isValidAddress = watchChainId !== undefined
    const isDuplicateAddress =
        watchChainId !== undefined &&
        !!findAccountByAddressOn(accounts, watchChainId, resolvedAddress)

    const handleAddressChange = useCallback((text: string) => {
        setAddress(text)
    }, [])

    const handleWatchAccount = useCallback(() => {
        if (
            watchChainId === undefined ||
            isDuplicateAddress ||
            isWatchingRef.current
        ) {
            return
        }
        isWatchingRef.current = true
        void (async () => {
            try {
                const account = await importWatchAccount(
                    watchChainId,
                    resolvedAddress,
                )
                trackEvent(OnboardingEvent.WatchAccountComplete, {
                    [AnalyticsMetadataKey.ChainId]: watchChainId,
                })
                if (!isMounted()) return
                navigation.push('NameAccount', {
                    account,
                    chainId: watchChainId,
                })
            } catch (error) {
                if (isMounted()) showError(error, t('errors.general.title'))
            } finally {
                isWatchingRef.current = false
            }
        })()
    }, [
        watchChainId,
        resolvedAddress,
        isDuplicateAddress,
        importWatchAccount,
        isMounted,
        navigation,
        showError,
        t,
    ])

    return {
        address,
        watchableChainIds,
        resolvedAddress,
        descriptionKey,
        invalidAddressKey,
        isValidAddress,
        isDuplicateAddress,
        isNfdResolved,
        isNfdResolving,
        nfdName,
        handleAddressChange,
        handleWatchAccount,
    }
}
