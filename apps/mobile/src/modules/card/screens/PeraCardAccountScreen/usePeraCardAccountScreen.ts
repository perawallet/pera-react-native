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
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useCardIssuance, useCardStore } from '@perawallet/wallet-core-card'
import { type AccountDisplayCard } from '@modules/accounts/components/AccountDisplay'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useCardComingSoonToast } from '../../hooks'

type UsePeraCardAccountScreenResult = {
    /** Pera Card identity rendered in the shared AccountSelection trigger. */
    cardDisplay: AccountDisplayCard
    onSelectAccount: () => void
    onMore: () => void
    onScan: () => void
    onInbox: () => void
}

export const usePeraCardAccountScreen = (): UsePeraCardAccountScreenResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const accounts = useAllAccounts()
    const connectedAddress = useCardStore(
        state => state.connectedFundingSourceAddress,
    )

    // The dashboard shell (not a tab) owns making sure the Baanx card gets
    // ordered once KYC clears: the KYC watch and the one-shot auto-order run
    // regardless of which tab is mounted or whether tabs become lazy. The
    // details tab mounts its own instance for display; the shared mutation
    // key keeps the two coordinated.
    useCardIssuance()

    const cardDisplay = useMemo<AccountDisplayCard>(() => {
        const account = connectedAddress
            ? accounts.find(item => item.address === connectedAddress)
            : undefined
        return {
            title: t('peraCard.account.navigation_title'),
            subtitle: account?.name
                ? t('peraCard.account.linked_to', { name: account.name })
                : t('peraCard.account.linked_to_fallback'),
        }
    }, [accounts, connectedAddress, t])

    // Picking a wallet account from the switcher returns to the wallet home.
    const onSelectAccount = useCallback(() => {
        navigation.navigate('TabBar', { screen: 'Home' })
    }, [navigation])

    // TODO(card): wire the more/scan/inbox actions once their destinations exist.
    const showComingSoon = useCardComingSoonToast()

    return {
        cardDisplay,
        onSelectAccount,
        onMore: showComingSoon,
        onScan: showComingSoon,
        onInbox: showComingSoon,
    }
}
