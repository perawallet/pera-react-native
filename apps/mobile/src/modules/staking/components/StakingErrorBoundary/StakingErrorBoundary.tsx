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
import { useLanguage } from '@hooks/useLanguage'
import { EmptyView } from '@components/EmptyView'
import { PWButton } from '@components/core'

export type StakingErrorBoundaryProps = {
    children: ReactNode
    t: (key: string, options?: Record<string, unknown>) => string
}

const StakingErrorFallback = ({ reset }: { reset: () => void }) => {
    const { t } = useLanguage()

    return (
        <EmptyView
            title={t('common.error.title')}
            body={t('common.error.body')}
            button={
                <PWButton
                    title={t('common.retry.label')}
                    variant='primary'
                    onPress={reset}
                />
            }
        />
    )
}

export const StakingErrorBoundary: React.FC<StakingErrorBoundaryProps> = ({
    children,
    t,
}) => {
    return (
        <BaseErrorBoundary
            category={ErrorCategory.STAKING}
            t={t}
            fallback={(_error, reset) => <StakingErrorFallback reset={reset} />}
        >
            {children}
        </BaseErrorBoundary>
    )
}
