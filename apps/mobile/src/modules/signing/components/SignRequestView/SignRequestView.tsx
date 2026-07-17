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

import {
    type SignRequest,
    useLastSigningEvent,
    useSigningPipeline,
    useSigningRequest,
    type SigningLifecycleEvent,
} from '@perawallet/wallet-core-signing'
import { RekeyTargetNotFoundError } from '@perawallet/wallet-core-accounts'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { SigningRoutes } from '@modules/signing/routes'
import {
    NavigationContainer,
    NavigationIndependentTree,
} from '@react-navigation/native'
import { PWButton, PWTouchableIcon, PWView } from '@components/core'
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
    onDismiss,
}: {
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
}) => {
    const { t } = useLanguage()
    const appError = error instanceof AppError ? error : null
    const handleGoBack = () => {
        onDismiss()
        reset()
    }
    return (
        <EmptyView
            title={t('errors.general.title')}
            body={appError ? t(appError.message) : t('errors.general.body')}
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

export const SignRequestView = ({ request }: SignRequestViewProps) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { removeSignRequest } = useSigningRequest()
    const { resolved } = useSigningPipeline()
    const failedEvent = useLastSigningEvent(
        (e): e is Extract<SigningLifecycleEvent, { type: 'failed' }> =>
            e.type === 'failed',
        request.id,
    )

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
    // failures, so we key off the most-recent `failed` event for this
    // request (retained per-request-id by the signing event bus) to swap
    // the signing routes for an inline error view. Dismiss stops the actor.
    if (failedEvent) {
        // WalletConnect requests surface failures through the WC error
        // bottom sheet (driven by the request's `error` callback), and the
        // callback also dismisses the sign request. Don't double-show the
        // full-screen failed view here — render nothing while the queue
        // settles.
        if (resolved?.source.kind === 'walletconnect') {
            return null
        }

        // Backstop for a rekeyed-to-external sender that slipped past the
        // up-front gate (useSigningActionButtons) and failed at machine init
        // — explain the rekey state instead of the generic failure copy.
        const rekeyTargetError =
            failedEvent.error instanceof RekeyTargetNotFoundError
                ? failedEvent.error
                : null
        const body =
            config.debugEnabled && failedEvent.error.message
                ? failedEvent.error.message
                : rekeyTargetError
                  ? t('signing.cannot_sign.rekeyed_auth_missing_body', {
                        authAddress: String(
                            rekeyTargetError.metadata.params?.rekeyAddress ??
                                '',
                        ),
                    })
                  : t('signing.signing_failed.body')
        const handleDismiss = () => {
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

    const isMultisigCosign = resolved?.source.kind === 'multisig-cosign'
    const handleClose = () => {
        removeSignRequest(request)
    }

    return (
        <BaseErrorBoundary
            t={t}
            category={ErrorCategory.BLOCKCHAIN}
            fallback={(error, reset) => (
                <SignRequestErrorFallback
                    error={error}
                    reset={reset}
                    onDismiss={() => removeSignRequest(request)}
                />
            )}
        >
            <PWView style={styles.container}>
                <NavigationIndependentTree>
                    <NavigationContainer>
                        <SigningRoutes request={request} />
                    </NavigationContainer>
                </NavigationIndependentTree>
                {isMultisigCosign && (
                    <PWTouchableIcon
                        name='cross'
                        size='md'
                        variant='primary'
                        onPress={handleClose}
                        containerStyle={styles.closeButton}
                        testID='multisig_cosign_close_button'
                    />
                )}
            </PWView>
        </BaseErrorBoundary>
    )
}
