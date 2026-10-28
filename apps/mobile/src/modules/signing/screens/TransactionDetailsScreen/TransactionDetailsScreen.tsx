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

import { PWButton, PWScreen } from '@components/core'
import { AddressReuseGuardProvider } from '@components/AddressReuseGuard'
import { ChainNotice } from '@components/ChainNotice'
import { LoadingView } from '@components/LoadingView'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { ExternalTransactionCallout } from '@modules/signing/components/ExternalTransactionCallout'
import { SuspectedPoisoningNotice } from '@modules/transactions'
import { RelatedTransactions } from '@modules/signing/transactions/RelatedTransactions'
import { TransactionDetailBody } from '@modules/signing/transactions/TransactionDetailBody'
import { useTransactionDetailsScreen } from './useTransactionDetailsScreen'

export const TransactionDetailsScreen = () => {
    const { t } = useLanguage()

    const {
        renderState,
        scope,
        groupId,
        isExternal,
        notice,
        suspectedPoisoning,
        addressReuseGuard,
        handleRelatedTransactionPress,
        handleRetry,
    } = useTransactionDetailsScreen()

    if (renderState.kind === 'content') {
        return (
            <AddressReuseGuardProvider guard={addressReuseGuard}>
                <PWScreen testID='transaction_details_screen'>
                    {notice && (
                        <ChainNotice
                            {...notice}
                            testID='transaction_details_notice'
                        />
                    )}
                    {suspectedPoisoning && (
                        <SuspectedPoisoningNotice
                            suspectedPoisoning={suspectedPoisoning}
                            scope={scope}
                        />
                    )}
                    <TransactionDetailBody
                        transaction={renderState.transaction}
                        onRelatedTransactionPress={
                            handleRelatedTransactionPress
                        }
                    />
                    {isExternal && <ExternalTransactionCallout />}
                    <RelatedTransactions
                        groupId={groupId}
                        currentTransaction={renderState.transaction}
                        onRelatedTransactionPress={
                            handleRelatedTransactionPress
                        }
                    />
                </PWScreen>
            </AddressReuseGuardProvider>
        )
    }

    if (renderState.kind === 'loading') {
        return (
            <LoadingView
                variant='circle'
                size='lg'
            />
        )
    }

    if (renderState.kind === 'offline') {
        return (
            <EmptyView
                testID='transaction_details_offline_view'
                title={t('errors.network.no_connection.title')}
                body={t('errors.network.no_connection.body')}
                button={
                    <PWButton
                        variant='primary'
                        title={t('common.retry.label')}
                        onPress={handleRetry}
                    />
                }
            />
        )
    }

    return (
        <EmptyView
            testID='transaction_details_error_view'
            title={t(renderState.titleKey)}
            body={t(renderState.bodyKey)}
            button={
                <PWButton
                    variant='primary'
                    title={t('common.retry.label')}
                    onPress={handleRetry}
                />
            }
        />
    )
}
