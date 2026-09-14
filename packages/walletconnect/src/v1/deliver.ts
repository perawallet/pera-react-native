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

import { logger } from '@perawallet/wallet-core-shared'
import { ensureConnectorReady } from '../connection'
import { WC_DELIVERY_TIMEOUT_MS } from '../shared/constants'

// A backgrounded v1 socket queues sends silently, so every response goes
// through a socket verified open; a failed revival throws a retryable timeout.
export const deliverApprove = async (
    clientId: string,
    id: number,
    result: unknown,
): Promise<void> => {
    const readyConnector = await ensureConnectorReady(
        clientId,
        WC_DELIVERY_TIMEOUT_MS,
    )
    await readyConnector.approveRequest({ id, result })
}

export const deliverReject = async (
    clientId: string,
    id: number,
    error: Error,
): Promise<void> => {
    const readyConnector = await ensureConnectorReady(
        clientId,
        WC_DELIVERY_TIMEOUT_MS,
    )
    readyConnector.rejectRequest({ id, error })
}

// For cleanup paths that must never throw back into the caller; a failed
// revival leaves the dApp timing out, as a send into the dead socket would.
export const deliverRejectInBackground = (
    clientId: string,
    id: number,
    error: Error,
): void => {
    void deliverReject(clientId, id, error).catch((deliveryError: unknown) => {
        logger.warn('WC reject delivery failed', {
            clientId,
            id,
            error:
                deliveryError instanceof Error
                    ? deliveryError.message
                    : String(deliveryError),
        })
    })
}
