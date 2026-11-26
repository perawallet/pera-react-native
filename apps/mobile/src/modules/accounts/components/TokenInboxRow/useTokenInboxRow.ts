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

import { useCallback, useMemo } from 'react'
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    isWatchAccount,
    useAccountHoldingSources,
    useTokenInboxQuery,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useAssetPreferencesStore } from '@perawallet/wallet-core-assets'
import { useSelectedNetworkSource } from '../../hooks/useSelectedNetworkSource'

export type UseTokenInboxRowResult = {
    count: number
    /** Off while the list already shows suspicious assets, none wait in the inbox, or the account is watched (it has no inbox). */
    isVisible: boolean
    handlePress: () => void
}

/** The tokens waiting in the inbox on the network the list shows; tapping opens the account's inbox. */
export const useTokenInboxRow = (
    account: WalletAccount,
): UseTokenInboxRowResult => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const showSuspicious = useAssetPreferencesStore(
        state => state.showSuspicious,
    )
    const accountSources = useAccountHoldingSources(account)
    const selected = useSelectedNetworkSource(accountSources)
    const sources = useMemo(
        () => (selected ? [selected] : accountSources),
        [accountSources, selected],
    )
    const { holdings } = useTokenInboxQuery(sources)
    const handlePress = useCallback(
        () =>
            navigation.navigate('Messages', {
                screen: 'AssetTransferRequests',
                params: { accountId: account.id },
            }),
        [navigation, account.id],
    )
    return {
        count: holdings.length,
        isVisible:
            !showSuspicious && !isWatchAccount(account) && holdings.length > 0,
        handlePress,
    }
}
