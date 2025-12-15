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
import PWBottomSheet from '../../common/bottom-sheet/PWBottomSheet'
import EmptyView from '../../common/empty-view/EmptyView'
import SendFundsAssetSelectionView from '../asset-selection/SendFundsAssetSelectionView'
import SendFundsInputView from '../input-view/SendFundsInputView'

import { useContext, useLayoutEffect, useState } from 'react'
import { useStyles } from './styles'
import { useWindowDimensions } from 'react-native'
import { TabView } from '@rneui/themed'
import SendFundsSelectDestination from '../select-destination/SendFundsSelectDestination'
import SendFundsTransactionConfirmation from '../transaction-confirmation/SendFundsTransactionConfirmation'
import SendFundsProvider, {
    SendFundsContext,
} from '@providers/SendFundsProvider'
import { TAB_ANIMATION_CONFIG } from '@constants/ui'
import { useLanguage } from '@hooks/language'

type SendFundsBottomSheetProps = {
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
const SendFundsBottomSheet = ({
    assetId,
    onClose,
    isVisible,
}: SendFundsBottomSheetProps) => {
    const selectedAccount = useSelectedAccount()
    const [screenIndex, setScreenIndex] = useState(0)
    const dimensions = useWindowDimensions()
    const styles = useStyles(dimensions)
    const { t } = useLanguage()
    const {
        canSelectAsset,
        setSelectedAsset,
        setCanSelectAsset,
        setNote,
        setAmount,
        setDestination,
    } = useContext(SendFundsContext)
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
            clearContext()
            onClose()
        } else {
            setScreenIndex(screenIndex + 1)
        }
    }

    const handleBack = () => {
        if (screenIndex === 0) {
            clearContext()
            onClose()
        } else {
            setScreenIndex(screenIndex - 1)
        }
    }

    const clearContext = () => {
        setNote(undefined)
        setAmount(undefined)
        setDestination(undefined)
    }

    return (
        <PWBottomSheet
            isVisible={isVisible}
            innerContainerStyle={styles.container}
        >
            <SendFundsProvider>
                {selectedAccount ? (
                    <TabView
                        value={screenIndex}
                        animationType='timing'
                        animationConfig={TAB_ANIMATION_CONFIG}
                        disableSwipe
                    >
                        {!!canSelectAsset && (
                            <TabView.Item style={styles.tabItem}>
                                <SendFundsAssetSelectionView
                                    onSelected={handleNext}
                                    onBack={handleBack}
                                />
                            </TabView.Item>
                        )}
                        <TabView.Item style={styles.tabItem}>
                            <SendFundsInputView
                                onNext={handleNext}
                                onBack={handleBack}
                            />
                        </TabView.Item>
                        <TabView.Item style={styles.tabItem}>
                            <SendFundsSelectDestination
                                onNext={handleNext}
                                onBack={handleBack}
                            />
                        </TabView.Item>
                        <TabView.Item style={styles.tabItem}>
                            <SendFundsTransactionConfirmation
                                onNext={handleNext}
                                onBack={handleBack}
                            />
                        </TabView.Item>
                    </TabView>
                ) : (
                    <EmptyView
                        title={t('send_funds.bottom_sheet.no_account_title')}
                        body={t('send_funds.bottom_sheet.no_account_body')}
                    />
                )}
            </SendFundsProvider>
        </PWBottomSheet>
    )
}

export default SendFundsBottomSheet
