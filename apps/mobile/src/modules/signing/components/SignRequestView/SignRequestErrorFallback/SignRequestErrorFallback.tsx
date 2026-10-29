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

import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { PWButton } from '@components/core'
import { AppError } from '@perawallet/wallet-core-shared'

export type SignRequestErrorFallbackProps = {
    error: AppError | Error
    reset: () => void
    /**
     * Drops the offending request from the queue so the next render
     * doesn't reproduce the same crash. Without this, the error boundary
     * `reset` just re-runs the same render against the same store state
     * and the user is trapped in the failed sheet (especially bad for
     * persisted requests that survive restart).
     */
    onDismiss: () => void
}

export const SignRequestErrorFallback = ({
    error,
    reset,
    onDismiss,
}: SignRequestErrorFallbackProps) => {
    const { t } = useLanguage()
    const appError = error instanceof AppError ? error : null
    const handleGoBack = () => {
        onDismiss()
        reset()
    }
    return (
        <EmptyView
            title={t('errors.general.title')}
            body={
                appError?.metadata.messageKey
                    ? t(appError.metadata.messageKey, appError.metadata.params)
                    : t('errors.general.body')
            }
            button={
                <PWButton
                    title={t('common.go_back.label')}
                    variant='primary'
                    onPress={handleGoBack}
                />
            }
        />
    )
}
