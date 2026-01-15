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

export type PWDialogProps = {
    isVisible: boolean
    onBackdropPress?: () => void
    children?: React.ReactNode
    overlayStyle?: StyleProp<ViewStyle>
}

const PWDialogComponent = ({
    isVisible,
    onBackdropPress,
    children,
    overlayStyle,
}: PWDialogProps) => {
    return (
        <RNEDialog
            isVisible={isVisible}
            onBackdropPress={onBackdropPress}
            overlayStyle={overlayStyle}
        >
            {children}
        </RNEDialog>
    )
}

const PWDialogTitle = (props: {
    title: string
    titleStyle?: StyleProp<TextStyle>
}) => {
    return (
        <RNEDialog.Title
            title={props.title}
            titleStyle={props.titleStyle}
        />
    )
}

const PWDialogActions = (props: { children: React.ReactNode }) => {
    return <RNEDialog.Actions>{props.children}</RNEDialog.Actions>
}

const PWDialogButton = (props: {
    title: string
    onPress?: () => void
    titleStyle?: StyleProp<TextStyle>
}) => {
    return (
        <RNEDialog.Button
            title={props.title}
            onPress={props.onPress}
            titleStyle={props.titleStyle}
        />
    )
}

export const PWDialog = Object.assign(PWDialogComponent, {
    Title: PWDialogTitle,
    Actions: PWDialogActions,
    Button: PWDialogButton,
})
