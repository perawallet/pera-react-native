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

import type { StyleProp, ViewStyle } from 'react-native'
import { PWIcon, type PWIconProps } from '../PWIcon'
import { PWTouchableOpacity } from '../PWTouchableOpacity'

export type PWTouchableIconProps = {
    onPress: () => void
    containerStyle?: StyleProp<ViewStyle>
    testID?: string
    dismissKeyboardOnPress?: boolean
} & PWIconProps

export const PWTouchableIcon = ({
    onPress,
    containerStyle,
    testID,
    dismissKeyboardOnPress,
    ...rest
}: PWTouchableIconProps) => (
    <PWTouchableOpacity
        style={containerStyle}
        onPress={onPress}
        testID={testID}
        dismissKeyboardOnPress={dismissKeyboardOnPress}
    >
        <PWIcon {...rest} />
    </PWTouchableOpacity>
)
