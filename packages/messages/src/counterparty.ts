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

import type { Optional } from '@perawallet/wallet-core-shared'
import type { PeraNotification } from './models'

const COUNTERPARTY_NOTIFICATION_TYPES: ReadonlySet<string> = new Set([
    'evm-transfer-received',
    'evm-transfer-sent',
    'evm-transfer-failed',
])

// Must match the backend's evm_address_display (bun evmAddressDisplay).
const backendShortAddress = (address: string): string =>
    `${address.slice(0, 6)}…${address.slice(-4)}`

export const notificationCounterpartyAddress = (
    notification: PeraNotification,
): Optional<string> => {
    const { type, message, counterpartyAddress } = notification
    if (!type || !COUNTERPARTY_NOTIFICATION_TYPES.has(type)) return undefined
    if (!message || !counterpartyAddress) return undefined
    return counterpartyAddress
}

export const nameNotificationCounterparty = (
    notification: PeraNotification,
    name: string,
): PeraNotification => {
    const address = notificationCounterpartyAddress(notification)
    const message = notification.message
    if (!address || !name || !message) return notification

    // The backend sends lowercase hex while accounts store EIP-55. Slicing by
    // index below is only safe when lowercasing kept every character in place.
    const haystack = message.toLowerCase()
    if (haystack.length !== message.length) return notification

    const needle = backendShortAddress(address).toLowerCase()
    const start = haystack.indexOf(needle)
    if (start === -1 || haystack.indexOf(needle, start + 1) !== -1) {
        return notification
    }

    return {
        ...notification,
        message: `${message.slice(0, start)}${name}${message.slice(start + needle.length)}`,
    }
}
