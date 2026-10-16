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

import { useCallback, useState } from 'react'
import { useRoute, type RouteProp } from '@react-navigation/native'
import { useAppNavigation } from '@hooks/useAppNavigation'
import {
    buildAccount,
    useAccountsStore,
    useAllAccounts,
    findAccountByAddressOn,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { trackEvent, OnboardingEvent } from '@analytics'
import { useCapabilityCheck } from '@hooks/useCapability'
import { useNfdResolve } from '@hooks/useNfdResolve'
import type { AddAccountStackParamList } from '@modules/onboarding/routes/types'

type UseWatchAccountScreenResult = {
    address: string
    /** The chains an address can be watched on, for the field's scanner. */
    watchableChainIds: readonly ChainId[]
    resolvedAddress: string
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
    const setAccounts = useAccountsStore(state => state.setAccounts)
    const [address, setAddress] = useState(route.params?.prefillAddress ?? '')

    const { resolvedAddress, isNfdResolved, isNfdResolving, nfdName } =
        useNfdResolve(address)

    const checkCapability = useCapabilityCheck()
    const { chains } = getProvider()
    const watchableChainIds = addressCodecs
        .list()
        .map(codec => codec.chainId)
        .filter(
            chainId =>
                chains.has(chainId) &&
                checkCapability({
                    chain: { chainId, capability: 'watchAccounts' },
                }),
        )
    // Registration order decides when several chains accept the same address.
    const watchChainId = watchableChainIds.find(chainId =>
        addressCodecs.get(chainId).isValid(resolvedAddress),
    )

    const isValidAddress = watchChainId !== undefined
    const isDuplicateAddress =
        watchChainId !== undefined &&
        !!findAccountByAddressOn(accounts, watchChainId, resolvedAddress)

    const handleAddressChange = useCallback((text: string) => {
        setAddress(text)
    }, [])

    const handleWatchAccount = useCallback(() => {
        if (watchChainId === undefined || isDuplicateAddress) {
            return
        }

        const newAccount = buildAccount({
            custody: { kind: 'watch' },
            chainId: watchChainId,
            chains: {
                [watchChainId]: {
                    address: addressCodecs
                        .get(watchChainId)
                        .normalize(resolvedAddress),
                },
            },
        })

        setAccounts([...accounts, newAccount])
        trackEvent(OnboardingEvent.WatchAccountComplete)
        navigation.push('NameAccount', {
            account: newAccount,
        })
    }, [
        watchChainId,
        resolvedAddress,
        isDuplicateAddress,
        accounts,
        setAccounts,
        navigation,
    ])

    return {
        address,
        watchableChainIds,
        resolvedAddress,
        isValidAddress,
        isDuplicateAddress,
        isNfdResolved,
        isNfdResolving,
        nfdName,
        handleAddressChange,
        handleWatchAccount,
    }
}
