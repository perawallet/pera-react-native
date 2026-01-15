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

import { TouchableOpacity, TouchableOpacityProps } from 'react-native'

export type PWTouchableOpacityProps = {} & TouchableOpacityProps

const DEFAULT_ACTIVE_OPACITY = 0.8

export const PWTouchableOpacity = ({
    children,
    activeOpacity,
    ...rest
}: PWTouchableOpacityProps) => {
    return (
        <TouchableOpacity
            {...rest}
            activeOpacity={activeOpacity ?? DEFAULT_ACTIVE_OPACITY}
        >
            {children}
        </TouchableOpacity>
    )
}
