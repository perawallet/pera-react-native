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
import { PWButton } from '@components/core/PWButton'
import { useToast } from '@hooks/toast'
import { WalletConnectError } from '@perawallet/wallet-core-walletconnect'
import { bottomSheetNotifier } from '@components/core/PWBottomSheet'

interface WalletConnectErrorBoundaryProps {
    children: ReactNode
    t: (key: string, options?: Record<string, unknown>) => string
}

const WalletConnectErrorFallback = ({
    error,
    reset,
    children,
}: {
    error: Error
    reset: () => void
    children: ReactNode
}) => {
    const { t } = useLanguage()

    if (error instanceof WalletConnectError) {
        return children
    }

    return (
        <EmptyView
            title={t('errors.walletconnect.title')}
            body={t('errors.walletconnect.body')}
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
 * Error boundary for walletconnect-related flows
 * Displays walletconnect-specific error messages
 */
export const WalletConnectErrorBoundary: React.FC<
    WalletConnectErrorBoundaryProps
> = ({ children, t }) => {
    const { showToast } = useToast()
    const handleError = (error: Error) => {
        if (error instanceof WalletConnectError) {
            const bodyKey = `${error.getI18nKey()}_body`
            showToast(
                {
                    title: t(error.getI18nKey()),
                    body: t(bodyKey),
                    type: 'error',
                },
                {
                    notifier: bottomSheetNotifier.current ?? undefined,
                },
            )
        }
    }

    return (
        <BaseErrorBoundary
            category={ErrorCategory.WALLETCONNECT}
            t={t}
            onError={handleError}
            fallback={(_error, reset) => (
                <WalletConnectErrorFallback
                    error={_error}
                    reset={reset}
                >
                    {children}
                </WalletConnectErrorFallback>
            )}
        >
            {children}
        </BaseErrorBoundary>
    )
}
