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
import { ErrorCategory } from '@perawallet/wallet-core-shared'
import { BaseErrorBoundary } from '@components/BaseErrorBoundary'
import { useLanguage } from '@hooks/language'
import { EmptyView } from '@components/EmptyView'
import { PWButton } from '@components/PWButton'

interface AccountErrorBoundaryProps {
    children: ReactNode
    t: (key: string, options?: Record<string, unknown>) => string
}

const AccountErrorFallback = ({ reset }: { reset: () => void }) => {
    const { t } = useLanguage()

    return (
        <EmptyView
            title={t('errors.account.title')}
            body={t('errors.account.body')}
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

/**
 * Error boundary for account-related flows
 * Displays account-specific error messages
 */
export const AccountErrorBoundary: React.FC<AccountErrorBoundaryProps> = ({
    children,
    t,
}) => {
    return (
        <BaseErrorBoundary
            category={ErrorCategory.ACCOUNTS}
            t={t}
            fallback={(_error, reset) => <AccountErrorFallback reset={reset} />}
        >
            {children}
        </BaseErrorBoundary>
    )
}
