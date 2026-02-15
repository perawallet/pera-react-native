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

import {
    useAccountAssetBalanceQuery,
    useSelectedAccount,
} from '@perawallet/wallet-core-accounts'
import { PWBottomSheet } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import {
    NavigationContainer,
    NavigationIndependentTree,
} from '@react-navigation/native'

import { useLayoutEffect } from 'react'
import { useStyles } from './styles'
import { useWindowDimensions } from 'react-native'
import { useSendFunds } from '@modules/transactions/hooks'
import { TransactionErrorBoundary } from '@modules/transactions/components/BaseErrorBoundary/TransactionErrorBoundary'
import { useLanguage } from '@hooks/useLanguage'
import { SendFundsRoutes } from '../../../routes/send-funds'

export type SendFundsBottomSheetProps = {
    assetId?: string
    isVisible: boolean
    onClose: () => void
}

export const SendFundsBottomSheet = ({
    assetId,
    onClose,
    isVisible,
}: SendFundsBottomSheetProps) => {
    const selectedAccount = useSelectedAccount()
    const dimensions = useWindowDimensions()
    const styles = useStyles(dimensions)
    const { t } = useLanguage()

    const {
        canSelectAsset,
        setSelectedAsset,
        setCanSelectAsset,
        setOnFinished,
        reset,
        selectedAsset,
    } = useSendFunds()
    const { data: assetBalance } = useAccountAssetBalanceQuery(
        selectedAccount ?? undefined,
        assetId,
    )

    useLayoutEffect(() => {
        if (isVisible && assetId != null) {
            if (canSelectAsset) {
                setCanSelectAsset(false)
            }

            if (assetBalance && selectedAsset?.assetId !== assetId) {
                setSelectedAsset(assetBalance)
            }
        }
    }, [
        isVisible,
        assetId,
        assetBalance,
        setCanSelectAsset,
        setSelectedAsset,
        canSelectAsset,
        selectedAsset?.assetId,
    ])

    const handleFinished = () => {
        reset()
        onClose()
    }

    useLayoutEffect(() => {
        if (isVisible) {
            setOnFinished(handleFinished)
        }
    }, [isVisible, handleFinished, setOnFinished])

    return (
        <PWBottomSheet
            isVisible={isVisible}
            innerContainerStyle={styles.container}
        >
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
        </PWBottomSheet>
    )
}
