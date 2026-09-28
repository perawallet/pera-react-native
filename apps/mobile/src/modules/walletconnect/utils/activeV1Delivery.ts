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

import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import {
    WalletConnectInvalidSessionError,
    type WalletConnectV1Delivery,
} from '@perawallet/wallet-core-walletconnect'

let activeDelivery: Nullable<WalletConnectV1Delivery> = null

/**
 * The v1 handler's sockets are its own instance state, and the multisig
 * handoff resolver mounts beside the connections provider rather than inside
 * it, so the composition root publishes its handler here. A module `let`, not
 * a store: nothing renders off it.
 */
export const setActiveWalletConnectV1Delivery = (
    delivery: WalletConnectV1Delivery,
): void => {
    activeDelivery = delivery
}

/** No-op unless `delivery` is still the active one: a departing owner must never clear its successor. */
export const clearActiveWalletConnectV1Delivery = (
    delivery: WalletConnectV1Delivery,
): void => {
    if (activeDelivery === delivery) activeDelivery = null
}

const requireDelivery = (): WalletConnectV1Delivery => {
    if (!activeDelivery) {
        throw new WalletConnectInvalidSessionError(
            'No WalletConnect v1 handler is mounted to deliver through',
        )
    }
    return activeDelivery
}

export const deliverApprove: WalletConnectV1Delivery['deliverApprove'] = async (
    clientId,
    id,
    result,
) => requireDelivery().deliverApprove(clientId, id, result)

export const deliverReject: WalletConnectV1Delivery['deliverReject'] = async (
    clientId,
    id,
    error,
) => requireDelivery().deliverReject(clientId, id, error)

export const deliverRejectInBackground: WalletConnectV1Delivery['deliverRejectInBackground'] =
    (clientId, id, error) => {
        if (!activeDelivery) {
            logger.warn('WC reject delivery skipped: no v1 handler mounted', {
                clientId,
                id,
            })
            return
        }
        activeDelivery.deliverRejectInBackground(clientId, id, error)
    }
