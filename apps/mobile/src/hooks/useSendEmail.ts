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

import { useCallback } from 'react'
import { Linking } from 'react-native'
import { useToast } from './useToast'
import { useLanguage } from '@hooks/useLanguage'

type SendEmailArgs = {
    /** Recipient inbox, a bare address (no `mailto:` prefix). */
    to: string
    subject?: string
    body?: string
}

type UseSendEmailResult = {
    /**
     * Opens the device mail composer prefilled via a `mailto:` link. Surfaces
     * an error toast when no mail client can handle it (iOS Simulator, or a
     * device with no mail account) rather than failing silently.
     */
    sendEmail: (args: SendEmailArgs) => void
}

export const useSendEmail = (): UseSendEmailResult => {
    const { errorToast } = useToast()
    const { t } = useLanguage()

    const sendEmail = useCallback(
        ({ to, subject, body }: SendEmailArgs) => {
            const query = [
                subject && `subject=${encodeURIComponent(subject)}`,
                body && `body=${encodeURIComponent(body)}`,
            ]
                .filter(Boolean)
                .join('&')
            const url = `mailto:${to}${query ? `?${query}` : ''}`

            Linking.openURL(url).catch(() => {
                errorToast(
                    t('common.email_failed.title'),
                    t('common.email_failed.body', { email: to }),
                )
            })
        },
        [errorToast, t],
    )

    return { sendEmail }
}
