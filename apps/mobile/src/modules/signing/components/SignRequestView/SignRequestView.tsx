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

import { SignRequest, useSigningRequest } from '@perawallet/wallet-core-signing'
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
import { config } from '@perawallet/wallet-core-config'
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
    const { lastFailedRequest, clearLastFailedRequest, removeSignRequest } =
        useSigningRequest()

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

    // Render-time error boundaries don't catch the XState actor's async
    // failures, so we key off lastFailedRequest (published to the store
    // from useSigningActorLifecycle) to swap the signing routes for an
    // inline error view. Dismiss stops the actor and clears the store.
    const failureForThisRequest =
        lastFailedRequest?.request.id === request.id ? lastFailedRequest : null

    if (failureForThisRequest) {
        const body =
            config.debugEnabled && failureForThisRequest.error.message
                ? failureForThisRequest.error.message
                : t('signing.signing_failed.body')
        const handleDismiss = () => {
            clearLastFailedRequest()
            removeSignRequest(request)
        }
        return (
            <EmptyView
                title={t('signing.signing_failed.title')}
                body={body}
                style={styles.errorView}
                button={
                    <PWButton
                        title={t('common.done')}
                        variant='primary'
                        onPress={handleDismiss}
                    />
                }
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
