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
import { PWBottomSheet, PWTabView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { SendFundsAssetSelectionView } from '../AssetSelection/SendFundsAssetSelectionView'
import { SendFundsInputView } from '../InputView/SendFundsInputView'

import { useLayoutEffect, useState } from 'react'
import { useStyles } from './styles'
import { useWindowDimensions } from 'react-native'
import { SendFundsSelectDestination } from '../SelectDestination/SendFundsSelectDestination'
import { SendFundsTransactionConfirmation } from '../TransactionConfirmation/SendFundsTransactionConfirmation'
import { useSendFunds } from '@modules/transactions/hooks'
import { TransactionErrorBoundary } from '@modules/transactions/components/BaseErrorBoundary/TransactionErrorBoundary'
import { TAB_ANIMATION_CONFIG } from '@constants/ui'
import { useLanguage } from '@hooks/language'

export type SendFundsBottomSheetProps = {
    assetId?: string
    isVisible: boolean
    onClose: () => void
}

export type ScreenState =
    | 'select-asset'
    | 'input-amount'
    | 'select-destination'
    | 'confirm-transaction'

const getScreenCount = (canSelectAsset: boolean) => {
    if (canSelectAsset) {
        return 4
    }
    return 3
}

//TODO: add support for ASA Inbox sends (check whether destination account is opted into asset)
//TODO: something isn't working with canSelectAsset
export const SendFundsBottomSheet = ({
    assetId,
    onClose,
    isVisible,
}: SendFundsBottomSheetProps) => {
    const selectedAccount = useSelectedAccount()
    const [screenIndex, setScreenIndex] = useState(0)
    const dimensions = useWindowDimensions()
    const styles = useStyles(dimensions)
    const { t } = useLanguage()
    const { canSelectAsset, setSelectedAsset, setCanSelectAsset, reset } =
        useSendFunds()
    const { data: assetBalance } = useAccountAssetBalanceQuery(
        selectedAccount ?? undefined,
        assetId,
    )

    useLayoutEffect(() => {
        if (assetId != null) {
            setSelectedAsset(assetBalance ?? undefined)
            setCanSelectAsset(false)
        }
    }, [assetId, assetBalance, setCanSelectAsset, setSelectedAsset])

    const handleNext = () => {
        if (screenIndex >= getScreenCount(!!canSelectAsset) - 1) {
            reset()
            onClose()
        } else {
            setScreenIndex(screenIndex + 1)
        }
    }

    const handleBack = () => {
        if (screenIndex === 0) {
            reset()
            onClose()
        } else {
            setScreenIndex(screenIndex - 1)
        }
    }

    return (
        <PWBottomSheet
            isVisible={isVisible}
            innerContainerStyle={styles.container}
        >
            <TransactionErrorBoundary t={t}>
                {selectedAccount ? (
                    <PWTabView
                        value={screenIndex}
                        animationType='timing'
                        animationConfig={TAB_ANIMATION_CONFIG}
                    >
                        {!!canSelectAsset && (
                            <PWTabView.Item style={styles.tabItem}>
                                <SendFundsAssetSelectionView
                                    onSelected={handleNext}
                                    onBack={handleBack}
                                />
                            </PWTabView.Item>
                        )}
                        <PWTabView.Item style={styles.tabItem}>
                            <SendFundsInputView
                                onNext={handleNext}
                                onBack={handleBack}
                            />
                        </PWTabView.Item>
                        <PWTabView.Item style={styles.tabItem}>
                            <SendFundsSelectDestination
                                onNext={handleNext}
                                onBack={handleBack}
                            />
                        </PWTabView.Item>
                        <PWTabView.Item style={styles.tabItem}>
                            <SendFundsTransactionConfirmation
                                onNext={handleNext}
                                onBack={handleBack}
                            />
                        </PWTabView.Item>
                    </PWTabView>
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
