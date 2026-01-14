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

import { BottomSheet, BottomSheetProps } from '@rneui/themed'
import PWView from '../PWView/PWView'
import { createRef, PropsWithChildren } from 'react'
import { useStyles } from './styles'
import { StyleProp, ViewStyle } from 'react-native'
import { NotifierRoot, NotifierWrapper } from 'react-native-notifier'

export const bottomSheetNotifier = createRef<NotifierRoot | null>()

export type PWBottomSheetProps = {
    innerContainerStyle?: StyleProp<ViewStyle>
    scrollEnabled?: boolean
} & BottomSheetProps &
    PropsWithChildren

const PWBottomSheet = ({
    innerContainerStyle,
    scrollEnabled,
    children,
    ...rest
}: PWBottomSheetProps) => {
    const style = useStyles()
    return (
        <BottomSheet
            {...rest}
            scrollViewProps={{ scrollEnabled: scrollEnabled ?? true }}
        >
            <NotifierWrapper
                omitGlobalMethodsHookup
                ref={bottomSheetNotifier}
            >
                <PWView style={[style.defaultStyle, innerContainerStyle]}>
                    {children}
                </PWView>
            </NotifierWrapper>
        </BottomSheet>
    )
}

export default PWBottomSheet
