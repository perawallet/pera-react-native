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

import React, { ReactNode } from 'react'
import { AppError, ErrorCategory } from '@perawallet/wallet-core-shared'
import { BaseErrorBoundary } from '@components/error-boundaries/BaseErrorBoundary'
import { useLanguage } from '@hooks/language'
import EmptyView from '@components/empty-view/EmptyView'
import PWButton from '@components/button/PWButton'

interface TransactionErrorBoundaryProps {
    children: ReactNode
    t: (key: string, options?: Record<string, unknown>) => string
}

const TransactionErrorFallback = ({
    error,
    reset,
}: {
    error: AppError | Error
    reset: () => void
}) => {
    const { t } = useLanguage()
    const appError = error instanceof AppError ? error : null

    return (
        <EmptyView
            title={t('errors.transaction.title')}
            body={appError
                ? t(appError.getI18nKey(), appError.metadata.params)
                : t('errors.generic.message')}
            button={<PWButton
                title={t('common.go_back')}
                variant='primary'
                onPress={reset}
            />}
        />
    )
}

/**
 * Error boundary for transaction-related flows
 * Displays transaction-specific error messages and recovery options
 */
export const TransactionErrorBoundary: React.FC<TransactionErrorBoundaryProps> = ({
    children,
    t
}) => {
    return (
        <BaseErrorBoundary
            t={t}
            category={ErrorCategory.BLOCKCHAIN}
            fallback={(error, reset) => (
                <TransactionErrorFallback
                    error={error}
                    reset={reset}
                />
            )}
        >
            {children}
        </BaseErrorBoundary>
    )
}
