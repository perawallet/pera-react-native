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

import { useEffect } from 'react'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    useCardSession,
    useCardStatusQuery,
    useCardStore,
} from '@perawallet/wallet-core-card'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { CardOnboardingStackParamList } from '../../routes/card-onboarding/types'

export type UseStatusCardOnOtherAccountResult = {
    /**
     * Baanx already issued this user a card, but no account in this wallet is
     * bound to it, so creating one here would mint a second escrow card.
     */
    isCardOnOtherAccount: boolean
    /** Whether Baanx has a card is not known yet, so creation must wait. */
    isCardLookupPending: boolean
}

/** Hands a user whose card is bound elsewhere over to its own screen. */
export const useStatusCardOnOtherAccount = (
    scope: ChainScope,
): UseStatusCardOnOtherAccountResult => {
    const { isAuthenticated } = useCardSession()
    const hasEscrowCard = useCardStore(
        state => state.escrowCardAddress !== null,
    )
    const shouldLookForCard = isAuthenticated && !hasEscrowCard
    // The status key is per scope, not per user, and logout only invalidates
    // it, so a card cached before this mount may be a previous user's.
    const { data: card, isFetchedAfterMount } = useCardStatusQuery(scope, {
        enabled: shouldLookForCard,
        refetchOnMount: 'always',
    })
    const isCardOnOtherAccount =
        shouldLookForCard && isFetchedAfterMount && !!card
    // A failed read also counts as fetched, so a Baanx outage fails open:
    // blocking every first-card user is worse, and creation needs Baanx anyway.
    const isCardLookupPending = shouldLookForCard && !isFetchedAfterMount

    const isFocused = useIsFocused()
    const stackNavigation =
        useNavigation<
            NativeStackNavigationProp<
                CardOnboardingStackParamList,
                'CardOnboardingStatus'
            >
        >()
    useEffect(() => {
        if (!isCardOnOtherAccount || !isFocused) return
        stackNavigation.replace('CardOnOtherAccount')
    }, [isCardOnOtherAccount, isFocused, stackNavigation])

    return { isCardOnOtherAccount, isCardLookupPending }
}
