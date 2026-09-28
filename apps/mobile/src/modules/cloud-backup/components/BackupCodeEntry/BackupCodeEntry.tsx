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

import {
    PWNumpad,
    PWPinCircles,
    PWSheetLayout,
    PWText,
    PWView,
} from '@components/core'
import { SheetHeader } from '@modules/bottom-sheet'
import { usePreventScreenCapture } from '@hooks/usePreventScreenCapture'
import { usePinEntry } from '@modules/security'

import { useStyles } from './styles'

// Not `PIN_LENGTH`: this guards one QR envelope, and the "6-digit" wording in
// six locale bundles is written to this number.
const SYNC_CODE_LENGTH = 6

const SCREEN_CAPTURE_TAG = 'backup-code-entry'

export type BackupCodeEntryProps = {
    /** Kept short: `SheetHeader` centres and truncates it. */
    title: string
    description: string
    onCodeComplete: (code: string) => void
    isDisabled?: boolean
    hasError?: boolean
    onErrorAnimationComplete?: () => void
    testID?: string
}

/** Open with `size: 'auto'` and `autoCreateContainer: false`. */
export const BackupCodeEntry = ({
    title,
    description,
    onCodeComplete,
    isDisabled = false,
    hasError = false,
    onErrorAnimationComplete,
    testID,
}: BackupCodeEntryProps) => {
    usePreventScreenCapture(SCREEN_CAPTURE_TAG)
    const styles = useStyles()

    const { pin, handleKeyPress, clearPin } = usePinEntry({
        onPinComplete: onCodeComplete,
        length: SYNC_CODE_LENGTH,
    })

    // A new title means a new step, so the dots must not carry over.
    useEffect(() => {
        clearPin()
    }, [title, clearPin])

    return (
        <PWSheetLayout
            testID={testID}
            header={
                <SheetHeader
                    title={title}
                    showClose
                />
            }
        >
            <PWView style={styles.body}>
                <PWText variant='bodyLarge'>{description}</PWText>

                <PWPinCircles
                    length={SYNC_CODE_LENGTH}
                    filledCount={pin.length}
                    hasError={hasError}
                    onShakeComplete={() => {
                        clearPin()
                        onErrorAnimationComplete?.()
                    }}
                />

                <PWNumpad
                    onKeyPress={handleKeyPress}
                    isDisabled={isDisabled}
                    mode='pin'
                />
            </PWView>
        </PWSheetLayout>
    )
}
