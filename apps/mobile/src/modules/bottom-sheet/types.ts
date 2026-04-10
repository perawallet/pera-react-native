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

import type { ComponentType } from 'react'
import type { PWBottomSheetSize } from '@components/core'
import type { StyleProp, ViewStyle } from 'react-native'

/** Props that the renderer injects into every sheet content component */
export type InjectedSheetProps = {
    onClose: () => void
}

export type BottomSheetOptions = {
    size?: PWBottomSheetSize
    snapPoints?: (string | number)[]
    enablePanDownToClose?: boolean
    enableContentPanningGesture?: boolean
    autoCreateContainer?: boolean
    containerStyle?: StyleProp<ViewStyle>
    innerContainerStyle?: StyleProp<ViewStyle>
    testID?: string
}

export type BottomSheetStackEntry<
    P extends InjectedSheetProps = InjectedSheetProps,
> = {
    id: string
    component: ComponentType<P>
    props: Omit<P, keyof InjectedSheetProps>
    options: BottomSheetOptions
}
