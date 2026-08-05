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

import { useMemo } from 'react'
import { FundingType, useCardStore } from '@perawallet/wallet-core-card'
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { canAutoFund } from './useCardFundingSourcePicker'

/**
 * Whether auto funding is actually in effect, rather than merely what the store
 * last recorded.
 *
 * The persisted `selectedFundingType` can outlive the account it was chosen
 * for: it is written when the card is created and when the funding-type sheet
 * applies, but the connected funding account can change afterwards. If it
 * changes to one that can't sign the AutoDraw LSig (a Ledger), no delegation
 * can exist, so treating a stored `Auto` as live would overstate the spendable
 * balance and mislabel the funding type.
 */
export const useIsCardAutoFundingActive = (): boolean => {
    const selectedFundingType = useCardStore(state => state.selectedFundingType)
    const connectedAddress = useCardStore(
        state => state.connectedFundingSourceAddress,
    )
    const accounts = useAllAccounts()

    return useMemo(() => {
        if (selectedFundingType !== FundingType.Auto) return false
        const connectedAccount = accounts.find(
            account => account.address === connectedAddress,
        )
        return connectedAccount != null && canAutoFund(connectedAccount)
    }, [selectedFundingType, connectedAddress, accounts])
}
