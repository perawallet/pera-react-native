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
    NavigationContainer,
    NavigationIndependentTree,
} from '@react-navigation/native'

import { PWBottomSheet } from '@components/core'
import { BidaliRoutes } from '../../routes'
import { useBidaliBottomSheet } from './useBidaliBottomSheet'
import { useStyles } from './styles'

export type BidaliBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
}

export const BidaliBottomSheet = ({
    isVisible,
    onClose,
}: BidaliBottomSheetProps) => {
    const styles = useStyles()
    useBidaliBottomSheet(isVisible, onClose)

    return (
        <PWBottomSheet
            isVisible={isVisible}
            innerContainerStyle={styles.container}
            size='lg'
            autoCreateContainer={false}
            enablePanDownToClose
            onBackdropPress={onClose}
        >
            <NavigationIndependentTree>
                <NavigationContainer>
                    <BidaliRoutes />
                </NavigationContainer>
            </NavigationIndependentTree>
        </PWBottomSheet>
    )
}
