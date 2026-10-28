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

import { PWIcon, PWInput, PWTouchableOpacity, PWView } from '@components/core'
import { useStyles } from './styles'

export type OptionSelectorFieldProps = {
    label: string
    placeholder: string
    /** Display text of the current choice; the placeholder shows when empty. */
    value?: string
    /** Read out instead of `value` when it carries decoration (e.g. a flag). */
    spokenValue?: string
    onPress: () => void
    /** When set, shown below the field as a validation error. */
    errorMessage?: string
    /** Locks the field: no picker on press and the chevron is hidden. */
    disabled?: boolean
    testID?: string
}

/**
 * A read-only field styled like the text inputs (label + underline) that opens
 * a picker on press. When `disabled`, it's a static display (no press, no
 * chevron), used to show a server-confirmed value.
 */
export const OptionSelectorField = ({
    label,
    placeholder,
    value,
    spokenValue = value,
    onPress,
    errorMessage,
    disabled = false,
    testID,
}: OptionSelectorFieldProps) => {
    const styles = useStyles()

    return (
        <PWTouchableOpacity
            onPress={onPress}
            disabled={disabled}
            accessibilityRole='button'
            accessibilityLabel={`${label}, ${spokenValue || placeholder}`}
            testID={testID}
        >
            <PWView
                pointerEvents='none'
                importantForAccessibility='no-hide-descendants'
                accessibilityElementsHidden
            >
                <PWInput
                    label={label}
                    labelStyle={styles.label}
                    value={value ?? ''}
                    placeholder={placeholder}
                    // Always non-typeable (the touchable above owns the tap);
                    // `isDisabled` additionally dims it, so a server-confirmed
                    // value reads locked like the text fields beside it.
                    editable={false}
                    isDisabled={disabled}
                    renderErrorMessage={!!errorMessage}
                    errorMessage={errorMessage}
                    errorStyle={styles.errorMessage}
                    rightIcon={
                        disabled ? undefined : (
                            <PWIcon
                                name='chevron-down'
                                variant='secondary'
                            />
                        )
                    }
                    testID={testID ? `${testID}-input` : undefined}
                />
            </PWView>
        </PWTouchableOpacity>
    )
}
