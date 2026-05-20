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

import { useEffect, useRef } from 'react'
import {
    NavigationContainer,
    NavigationIndependentTree,
} from '@react-navigation/native'

import { EmptyView } from '@components/EmptyView'
import { TransactionErrorBoundary } from '@modules/transactions/components/TransactionErrorBoundary/TransactionErrorBoundary'
import { useLanguage } from '@hooks/useLanguage'
import { SendFundsRoutes } from '../../../routes/send-funds'
import { useSendFundsContent } from './useSendFundsContent'

export type SendFundsContentProps = {
    assetId?: string
}

export const SendFundsContent = ({ assetId }: SendFundsContentProps) => {
    const { t } = useLanguage()
    const { selectedAccount } = useSendFundsContent(assetId)

    // [LEDGER-DEBUG] Track whether the modal's nested navigator is mounted
    // (i.e. selectedAccount is truthy). If selectedAccount goes from truthy
    // → falsy mid-signing, the navigator unmounts and the user is "kicked
    // out" while execute() keeps running headlessly.
    const prevHadAccountRef = useRef<boolean | null>(null)
    useEffect(() => {
        const has = !!selectedAccount
        if (prevHadAccountRef.current !== has) {
            // eslint-disable-next-line no-console
            console.log(
                '[LEDGER-DEBUG] SendFundsContent selectedAccount changed:',
                {
                    hadAccount: prevHadAccountRef.current,
                    nowHasAccount: has,
                    address: selectedAccount?.address ?? null,
                    type: selectedAccount?.type ?? null,
                    at: new Date().toISOString(),
                },
            )
            prevHadAccountRef.current = has
        }
    }, [selectedAccount])

    useEffect(() => {
        // eslint-disable-next-line no-console
        console.log('[LEDGER-DEBUG] SendFundsContent MOUNTED', {
            at: new Date().toISOString(),
        })
        return () => {
            // eslint-disable-next-line no-console
            console.log('[LEDGER-DEBUG] SendFundsContent UNMOUNTED', {
                at: new Date().toISOString(),
            })
        }
    }, [])

    return (
        <TransactionErrorBoundary t={t}>
            {selectedAccount ? (
                <NavigationIndependentTree>
                    <NavigationContainer>
                        <SendFundsRoutes />
                    </NavigationContainer>
                </NavigationIndependentTree>
            ) : (
                <EmptyView
                    title={t('send_funds.bottom_sheet.no_account_title')}
                    body={t('send_funds.bottom_sheet.no_account_body')}
                />
            )}
        </TransactionErrorBoundary>
    )
}
