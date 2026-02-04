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

import { useState, useCallback } from 'react'
import { PWButton, PWView, bottomSheetNotifier } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import {
    useSigningRequest,
    useSigningRequestAnalysis,
    type TransactionSignRequest,
} from '@perawallet/wallet-core-signing'
import { config } from '@perawallet/wallet-core-config'
import { useStyles } from './styles'

export const SigningActionButtons = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { showToast } = useToast()
    const [isLoading, setIsLoading] = useState(false)

    const { pendingSignRequests, signAndSendRequest, rejectRequest } =
        useSigningRequest()
    const request = pendingSignRequests[0] as TransactionSignRequest
    const { allTransactions } = useSigningRequestAnalysis(request)

    const handleSignAndSend = useCallback(async () => {
        setIsLoading(true)
        try {
            await signAndSendRequest(request)
            if (request.transport !== 'algod') {
                showToast({
                    title: t('signing.transaction_view.success_title'),
                    body: t('signing.transaction_view.success_body'),
                    type: 'success',
                })
            }
        } catch (error) {
            if (request.transport === 'algod') {
                showToast(
                    {
                        type: 'error',
                        title: t(
                            'signing.transaction_view.transaction_failed_title',
                        ),
                        body: config.debugEnabled
                            ? `${error}`
                            : t(
                                  'signing.transaction_view.transaction_failed_body',
                              ),
                    },
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
            } else {
                request.error?.(`${error}`)
            }
        } finally {
            setIsLoading(false)
        }
    }, [request, signAndSendRequest, showToast, t])

    const handleReject = useCallback(() => {
        rejectRequest(request)
    }, [request, rejectRequest])

    return (
        <PWView style={styles.container}>
            <PWButton
                title={t('common.cancel.label')}
                variant='secondary'
                onPress={handleReject}
                isDisabled={isLoading}
                style={styles.button}
            />
            <PWButton
                title={
                    allTransactions.length > 1
                        ? t('common.confirm_all.label')
                        : t('common.confirm.label')
                }
                variant='primary'
                onPress={handleSignAndSend}
                isLoading={isLoading}
                style={styles.button}
            />
        </PWView>
    )
}
