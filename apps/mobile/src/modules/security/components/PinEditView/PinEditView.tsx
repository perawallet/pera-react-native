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

import { useWindowDimensions } from 'react-native'
import { PinEntry } from '@modules/security/components/PinEntry'
import { PinEntryMode, usePinEditView } from './usePinEditView'
import { useStyles } from './styles'
import {
    PWBottomSheet,
    PWIcon,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type PinEditViewProps = {
    mode: PinEntryMode | null
    onSuccess?: () => void
    onClose?: () => void
}

export const PinEditView = ({ mode, onSuccess, onClose }: PinEditViewProps) => {
    const { height } = useWindowDimensions()
    const insets = useSafeAreaInsets()
    const styles = useStyles({ height, insets })

    const {
        title,
        hasError,
        isDisabled,
        handlePinComplete,
        handleErrorAnimationComplete,
    } = usePinEditView({
        mode,
        onSuccess,
    })

    return (
        <PWBottomSheet
            isVisible={!!mode}
            containerStyle={styles.container}
            innerContainerStyle={styles.innerContainer}
            scrollEnabled={false}
        >
            <PWView style={styles.closeButtonContainer}>
                <PWTouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                >
                    <PWIcon name='cross' />
                </PWTouchableOpacity>
            </PWView>
            <PinEntry
                title={title}
                onPinComplete={handlePinComplete}
                isDisabled={isDisabled}
                hasError={hasError}
                onErrorAnimationComplete={handleErrorAnimationComplete}
            />
        </PWBottomSheet>
    )
}
