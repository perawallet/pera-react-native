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
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useAssetPreferencesStore } from '@perawallet/wallet-core-assets'
import { useAutoHiddenHoldings } from '../../hooks/useAutoHiddenHoldings'

export type UseAutoHiddenTokensRowResult = {
    count: number
    /** Off while the list already shows suspicious assets, or none are hidden. */
    isVisible: boolean
    handlePress: () => void
}

export const useAutoHiddenTokensRow = (
    account: WalletAccount,
): UseAutoHiddenTokensRowResult => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const showSuspicious = useAssetPreferencesStore(
        state => state.showSuspicious,
    )
    const { holdings } = useAutoHiddenHoldings(account)
    const handlePress = useCallback(
        () => navigation.navigate('AutoHiddenTokens'),
        [navigation],
    )
    return {
        count: holdings.length,
        isVisible: !showSuspicious && holdings.length > 0,
        handlePress,
    }
}
