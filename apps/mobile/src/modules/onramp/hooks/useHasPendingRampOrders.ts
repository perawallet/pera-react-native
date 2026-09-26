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

import { useIsFocused } from '@react-navigation/native'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useSelectedAccountAddress } from '@perawallet/wallet-core-accounts'
import {
    hasPendingRampOrder,
    useRampHistoryInfiniteQuery,
} from '@perawallet/wallet-core-onramp'

/**
 * Drives the "needs attention" dot on the History tab. Observes the same
 * unfiltered history query the list renders (one cache entry, one poll) and
 * only polls while the onramp screen is focused.
 *
 * Only inspects the loaded pages: history is newest-first and in-flight
 * orders are recent, so page one covers them. A pending order buried past
 * the loaded pages won't light the dot — if product ever needs "any pending
 * anywhere", this needs a dedicated pending-only signal again.
 */
export const useHasPendingRampOrders = (): boolean => {
    const { network } = useNetwork()
    const deviceId = useDeviceID(network) ?? ''
    const { selectedAccountAddress } = useSelectedAccountAddress()
    const isFocused = useIsFocused()

    const { items } = useRampHistoryInfiniteQuery({
        deviceId,
        accountAddress: selectedAccountAddress ?? '',
        isActive: isFocused,
    })

    return hasPendingRampOrder(items)
}
