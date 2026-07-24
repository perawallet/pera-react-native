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

import { useEffect } from 'react'

import { trackScreen, AnalyticsScreenName } from '@analytics'

import { PWButton, PWScreen } from '@components/core'
import { LoadingView } from '@components/LoadingView'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionDisplay } from '@modules/transactions/components/TransactionDisplay'
import { GroupTransactionsPanel } from '@modules/transactions/components/transaction-details'
import { ExternalTransactionCallout } from '@modules/signing/components/ExternalTransactionCallout'
import { useTransactionDetailsScreen } from './useTransactionDetailsScreen'

export const TransactionDetailsScreen = () => {
    const { t } = useLanguage()

    // Tracked in-screen rather than via the navigator's screenListeners: this
    // screen is also mounted inside the signing flow's own NavigationContainer
    // (SignRequestView), which has no screenListeners, so a centralized listener
    // would miss that path.
    useEffect(() => {
        trackScreen(AnalyticsScreenName.TransactionDetail)
    }, [])

    const {
        renderState,
        groupTransactions,
        currentTransactionId,
        isExternal,
        handleTransactionPress,
        handleRetry,
    } = useTransactionDetailsScreen()

    if (renderState.kind === 'content') {
        return (
            <PWScreen testID='transaction_details_screen'>
                <TransactionDisplay
                    transaction={renderState.transaction}
                    onInnerTransactionsPress={handleTransactionPress}
                />
                {isExternal && <ExternalTransactionCallout />}
                {groupTransactions.length > 1 && (
                    <GroupTransactionsPanel
                        groupTransactions={groupTransactions}
                        currentTransactionId={currentTransactionId}
                        onGroupTransactionPress={handleTransactionPress}
                    />
                )}
            </PWScreen>
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
