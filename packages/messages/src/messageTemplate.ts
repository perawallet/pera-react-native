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

import type { Maybe, Optional } from '@perawallet/wallet-core-shared'
import type { PeraNotification } from './models'

const PLACEHOLDER = /\{\{([^{}]+)\}\}/g

// The requesting client picks this type's sender unchecked, so the backend's
// mark on it doesn't make it a party the user may know by name.
const UNTRUSTED_ADDRESS_TYPES: ReadonlySet<string> = new Set([
    'asset-support-request',
])

export type NotificationAddressNamer = (address: string) => Optional<string>

type TemplatedNotification = Pick<
    PeraNotification,
    'type' | 'messageTemplate' | 'messageArguments'
>

export const hasNameableAddress = ({
    type,
    messageArguments,
}: TemplatedNotification): boolean =>
    !(type && UNTRUSTED_ADDRESS_TYPES.has(type)) &&
    Object.values(messageArguments ?? {}).some(argument => !!argument.address)

/**
 * Fills each `{{name}}` with its argument: the name `nameOf` gives a marked
 * address, else the backend's text. One pass, so a placeholder inside an
 * inserted value (a note can hold one) stays literal; a function replacer also
 * keeps `$` in a value from reading as a replacement pattern.
 */
export const renderNotificationMessage = (
    notification: TemplatedNotification,
    nameOf?: NotificationAddressNamer,
): Maybe<string> => {
    const { messageTemplate, messageArguments = {} } = notification
    if (messageTemplate == null) return messageTemplate
    const namer = nameOf && hasNameableAddress(notification) ? nameOf : null
    return messageTemplate.replace(PLACEHOLDER, (placeholder, key: string) => {
        // Own keys only: `{{constructor}}` must not reach the prototype.
        const argument = Object.prototype.hasOwnProperty.call(
            messageArguments,
            key,
        )
            ? messageArguments[key]
            : undefined
        if (!argument) return placeholder
        const name = argument.address ? namer?.(argument.address) : undefined
        return name || argument.text
    })
}
