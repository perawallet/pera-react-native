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

import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { useSelectedAccountAddress } from '@perawallet/wallet-core-accounts'
import { useRampHistoryInfiniteQuery } from '@perawallet/wallet-core-onramp'

/**
 * Whether the selected account has any pending onramp orders — drives the
 * "needs attention" dot on the History tab so a pending order is visible while
 * the user is on the Fund tab. Backed by a pending-filtered history query that
 * polls, so it clears on its own once orders settle.
 */
export const useHasPendingRampOrders = (): boolean => {
    const { network } = useNetwork()
    const deviceId = useDeviceID(network) ?? ''
    const { selectedAccountAddress } = useSelectedAccountAddress()

    const { items } = useRampHistoryInfiniteQuery({
        deviceId,
        accountAddress: selectedAccountAddress ?? '',
        status: 'pending',
    })

    return items.length > 0
}
