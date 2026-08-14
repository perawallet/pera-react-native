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
import { usePeraProvider } from '@perawallet/wallet-extension-provider'
import { useInboxInvalidator } from '@perawallet/wallet-core-messages'

/**
 * Refreshes the notification queries (badge, inbox, list) the moment a push
 * arrives while the app is foregrounded, instead of waiting out the 30 s
 * message-status poll.
 *
 * Mount once at the root: the platform service holds a single listener slot,
 * so registering from multiple places would clobber it. Platforms without a
 * foreground receive path don't implement the listener — the poll remains
 * the fallback there (and everywhere, e.g. for pushes suppressed by the OS).
 */
export const useNotificationReceivedListener = () => {
    const provider = usePeraProvider()
    const { invalidate } = useInboxInvalidator()

    useEffect(() => {
        return provider.pushNotification.addNotificationReceivedListener?.(
            invalidate,
        )
    }, [provider, invalidate])
}
