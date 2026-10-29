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

import React, { type ReactNode } from 'react'
import { useLanguage } from '@hooks/useLanguage'
import { EmptyView } from '@components/EmptyView'
import { PWButton } from '@components/core'
import { WalletConnectError } from '@perawallet/wallet-core-walletconnect'

export type WalletConnectErrorFallbackProps = {
    error: Error
    reset: () => void
    children: ReactNode
}

export const WalletConnectErrorFallback = ({
    error,
    reset,
    children,
}: WalletConnectErrorFallbackProps) => {
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
