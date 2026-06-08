/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useEffect, useRef } from 'react'
import { Linking } from 'react-native'
import { logger } from '@perawallet/wallet-core-shared'
import { useDeepLink } from './useDeepLink'

export const useDeeplinkListener = () => {
    const { handleDeepLink, isValidDeepLink } = useDeepLink()
    const hasHandledInitialUrl = useRef(false)

    useEffect(() => {
        const handleInitialUrl = async () => {
            try {
                const initialUrl = await Linking.getInitialURL()

                if (initialUrl && !hasHandledInitialUrl.current) {
                    hasHandledInitialUrl.current = true
                    logger.debug('Deeplink: Initial URL (cold start)', {
                        initialUrl,
                    })

                    if (isValidDeepLink(initialUrl)) {
                        // Small delay to ensure navigation is ready
                        setTimeout(() => {
                            void handleDeepLink(initialUrl, false, 'deeplink')
                        }, 500)
                    }
                }
            } catch (error) {
                logger.debug('Deeplink: Error getting initial URL', { error })
            }
        }

        void handleInitialUrl()

        const subscription = Linking.addEventListener('url', event => {
            logger.debug('Deeplink: URL event (warm start)', { url: event.url })

            if (isValidDeepLink(event.url)) {
                void handleDeepLink(event.url, false, 'deeplink')
            }
        })

        return () => {
            subscription.remove()
        }
    }, [handleDeepLink, isValidDeepLink])
}
