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

import { SignRequest } from '@perawallet/wallet-core-signing'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { SigningRoutes } from '@modules/signing/routes'
import {
    NavigationContainer,
    NavigationIndependentTree,
} from '@react-navigation/native'
import { PWButton, PWView } from '@components/core'
import { BaseErrorBoundary } from '@components/BaseErrorBoundary'
import { AppError, ErrorCategory } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'

export type SignRequestViewProps = {
    request: SignRequest
}

const SignRequestErrorFallback = ({
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
            title={t('errors.general.title')}
            body={appError ? t(appError.message) : t('errors.general.body')}
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

export const SignRequestView = ({ request }: SignRequestViewProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const isSupported =
        request.type === 'transactions' ||
        request.type === 'arbitrary-data' ||
        request.type === 'arc60'

    if (!isSupported) {
        return (
            <EmptyView
                title={t('signing.unknown_request_type.title')}
                body={t('signing.unknown_request_type.body')}
            />
        )
    }

    return (
        <BaseErrorBoundary
            t={t}
            category={ErrorCategory.BLOCKCHAIN}
            fallback={(error, reset) => (
                <SignRequestErrorFallback
                    error={error}
                    reset={reset}
                />
            )}
        >
            <PWView style={styles.container}>
                <NavigationIndependentTree>
                    <NavigationContainer>
                        <SigningRoutes request={request} />
                    </NavigationContainer>
                </NavigationIndependentTree>
            </PWView>
        </BaseErrorBoundary>
    )
}
