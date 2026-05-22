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

import { PWIcon, PWTouchableOpacity, PWView } from '@components/core'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { PinEditView } from '../PinEditView'
import type { PinEntryMode } from '../PinEditView'
import type { SavePinHandlerResult } from '../PinEditView/usePinEditView'
import { useStyles } from './styles'

export type PinEditContentProps = {
    mode: PinEntryMode
    testID?: string
    savePinHandler?: (pin: string) => Promise<SavePinHandlerResult>
}

/**
 * Bottom-sheet wrapper around `PinEditView`. Adds a close affordance in
 * the top-left and wires success to `resolve(true)` / close to
 * `dismiss()`. For inline navigation usage (where the screen header
 * already provides back/close), render `PinEditView` directly.
 */
export const PinEditContent = ({
    mode,
    testID,
    savePinHandler,
}: PinEditContentProps) => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const { resolve, dismiss } = useBottomSheetResult<boolean>()

    return (
        <PWView
            style={styles.container}
            testID={testID}
        >
            <PWView style={styles.closeButtonContainer}>
                <PWTouchableOpacity
                    style={styles.closeButton}
                    onPress={dismiss}
                    testID='close-button'
                >
                    <PWIcon name='cross' />
                </PWTouchableOpacity>
            </PWView>
            <PinEditView
                mode={mode}
                onSuccess={() => resolve(true)}
                savePinHandler={savePinHandler}
            />
        </PWView>
    )
}
