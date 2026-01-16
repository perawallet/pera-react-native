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

import { Dialog as RNEDialog } from '@rneui/themed'
import { StyleProp, ViewStyle, TextStyle } from 'react-native'

/**
 * Props for the PWDialog component.
 */
export type PWDialogProps = {
    /** Whether the dialog is visible */
    isVisible: boolean
    /** Callback when the backdrop is pressed */
    onBackdropPress?: () => void
    /** Content of the dialog */
    children?: React.ReactNode
    /** Optional style overrides for the overlay container */
    overlayStyle?: StyleProp<ViewStyle>
}

/**
 * A themed dialog component wrapping RNE Dialog for modal-like notifications and actions.
 * Supports subcomponents: {@link PWDialog.Title}, {@link PWDialog.Actions}, {@link PWDialog.Button}.
 *
 * @example
 * <PWDialog isVisible={isVisible}>
 *   <PWDialog.Title title="Warning" />
 *   <PWText>This action cannot be undone.</PWText>
 *   <PWDialog.Actions>
 *     <PWDialog.Button title="Confirm" />
 *   </PWDialog.Actions>
 * </PWDialog>
 */
const PWDialogComponent = ({
    isVisible,
    onBackdropPress,
    children,
    overlayStyle,
    ...props
}: PWDialogProps) => {
    return (
        <RNEDialog
            isVisible={isVisible}
            onBackdropPress={onBackdropPress}
            overlayStyle={overlayStyle}
            {...props}
        >
            {children}
        </RNEDialog>
    )
}

/**
 * Title component for the PWDialog.
 *
 * @example
 * <PWDialog.Title title="Warning" />
 */
const PWDialogTitle = ({
    title,
    titleStyle,
    ...props
}: {
    /** Title text to display */
    title: string
    /** Optional style overrides for the title text */
    titleStyle?: StyleProp<TextStyle>
}) => {
    return (
        <RNEDialog.Title
            title={title}
            titleStyle={titleStyle}
            {...props}
        />
    )
}

/**
 * Actions container component for the PWDialog.
 *
 * @example
 * <PWDialog.Actions>
 *   <PWDialog.Button title="Confirm" />
 * </PWDialog.Actions>
 */
const PWDialogActions = ({
    children,
    ...props
}: {
    /** Dialog action buttons */
    children: React.ReactNode
}) => {
    return <RNEDialog.Actions {...props}>{children}</RNEDialog.Actions>
}

/**
 * Button component for the PWDialog.Actions container.
 *
 * @example
 * <PWDialog.Button title="Confirm" onPress={handleConfirm} />
 */
const PWDialogButton = ({
    title,
    onPress,
    titleStyle,
    ...props
}: {
    /** Button title text */
    title: string
    /** Callback when the button is pressed */
    onPress?: () => void
    /** Optional style overrides for the button title text */
    titleStyle?: StyleProp<TextStyle>
}) => {
    return (
        <RNEDialog.Button
            title={title}
            onPress={onPress}
            titleStyle={titleStyle}
            {...props}
        />
    )
}

export const PWDialog = Object.assign(PWDialogComponent, {
    Title: PWDialogTitle,
    Actions: PWDialogActions,
    Button: PWDialogButton,
})
