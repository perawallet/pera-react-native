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

import React from 'react'
import { AppError } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { EmptyView } from '@components/EmptyView'
import { PWButton } from '@components/core'

export type TransactionErrorFallbackProps = {
    error: AppError | Error
    reset: () => void
}

export const TransactionErrorFallback = ({
    error,
    reset,
}: TransactionErrorFallbackProps) => {
    const { t } = useLanguage()
    const appError = error instanceof AppError ? error : null

    return (
        <EmptyView
            title={t('errors.transaction.title')}
            body={
                appError?.metadata.messageKey
                    ? t(appError.metadata.messageKey, appError.metadata.params)
                    : t('errors.transaction.body')
            }
            button={
                <PWButton
                    title={t('common.go_back.label')}
                    variant='primary'
                    onPress={reset}
                />
            }
        />
    )
}
