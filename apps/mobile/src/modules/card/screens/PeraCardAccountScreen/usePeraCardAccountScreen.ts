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

import { useCallback, useMemo } from 'react'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { useCardStore } from '@perawallet/wallet-core-card'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

type UsePeraCardAccountScreenResult = {
    linkedLabel: string
    onMore: () => void
    onScan: () => void
    onInbox: () => void
}

export const usePeraCardAccountScreen = (): UsePeraCardAccountScreenResult => {
    const { t } = useLanguage()
    const { infoToast } = useToast()
    const accounts = useAllAccounts()
    const connectedAddress = useCardStore(
        state => state.connectedFundingSourceAddress,
    )

    const linkedLabel = useMemo(() => {
        const account = connectedAddress
            ? accounts.find(item => item.address === connectedAddress)
            : undefined
        return account?.name
            ? t('peraCard.account.linked_to', { name: account.name })
            : t('peraCard.account.linked_to_fallback')
    }, [accounts, connectedAddress, t])

    // TODO(card): wire the more/scan/inbox actions once their destinations exist.
    const showComingSoon = useCallback(() => {
        infoToast(
            t('peraCard.account.coming_soon_title'),
            t('peraCard.account.coming_soon_body'),
        )
    }, [infoToast, t])

    return {
        linkedLabel,
        onMore: showComingSoon,
        onScan: showComingSoon,
        onInbox: showComingSoon,
    }
}
