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
import {
    FundingType,
    getCardFundingType,
    setCardFundingType,
    useCardAutoDrawEnabledQuery,
} from '@perawallet/wallet-core-card'
import { useCardScope } from './useCardScope'

/**
 * Brings the stored funding type in line with the on-chain switch. The store
 * only knows what this device chose, so a card restored on a new device, or
 * switched on another one, would otherwise show the wrong funding type.
 */
export const useSyncCardFundingTypeFromChain = (): void => {
    const scope = useCardScope()
    const { isEnabled, updatedAt } = useCardAutoDrawEnabledQuery(scope)

    // Keyed on fresh answers only: reacting to store changes would let a
    // cached answer undo a switch the user has just made.
    useEffect(() => {
        if (isEnabled === undefined) return
        const onChain = isEnabled ? FundingType.Auto : FundingType.Manual
        if (getCardFundingType() !== onChain) setCardFundingType(onChain)
    }, [isEnabled, updatedAt])
}
