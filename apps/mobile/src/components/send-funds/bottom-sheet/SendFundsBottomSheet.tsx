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

import { PeraAsset, useSelectedAccount } from '@perawallet/core'
import PWBottomSheet from '../../common/bottom-sheet/PWBottomSheet'
import EmptyView from '../../common/empty-view/EmptyView'
import SendFundsAssetSelectionView from '../asset-selection/SendFundsAssetSelectionView'
import SendFundsInputView from '../input-view/SendFundsInputView'

import { useContext, useLayoutEffect, useState } from 'react'
import { useStyles } from './styles'
import { useWindowDimensions } from 'react-native'
import { TabView, Text } from '@rneui/themed'
import SendFundsSelectDestination from '../select-destination/SendFundsSelectDestination'
import SendFundsTransactionConfirmation from '../transaction-confirmation/SendFundsTransactionConfirmation'
import SendFundsProvider, {
    SendFundsContext,
} from '../../../providers/SendFundsProvider'

type SendFundsBottomSheetProps = {
    asset?: PeraAsset
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
//TODO: we need to useCachedAssets so that we get the USD price and can show that
//TODO: something isn't working with canSelectAsset
const SendFundsBottomSheet = ({
    asset,
    onClose,
    isVisible,
}: SendFundsBottomSheetProps) => {
    const selectedAccount = useSelectedAccount()
    const [screenIndex, setScreenIndex] = useState(0)
    const dimensions = useWindowDimensions()
    const styles = useStyles(dimensions)
    const {
        canSelectAsset,
        setSelectedAsset,
        setCanSelectAsset,
        setNote,
        setAmount,
        setDestination,
    } = useContext(SendFundsContext)

    useLayoutEffect(() => {
        if (asset) {
            setSelectedAsset(asset)
            setCanSelectAsset(false)
        }
    }, [asset, setCanSelectAsset, setSelectedAsset])

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
                        animationConfig={{
                            duration: 200,
                            useNativeDriver: true,
                        }}
                        disableSwipe
                    >
                        {!!canSelectAsset && <TabView.Item style={styles.tabItem}>
                            <SendFundsAssetSelectionView
                                onSelected={handleNext}
                                onBack={handleBack}
                            />
                        </TabView.Item>}
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
                        title='No Account Selected'
                        body='No account has been selected, please select an account first'
                    />
                )}
            </SendFundsProvider>
        </PWBottomSheet>
    )
}

export default SendFundsBottomSheet
