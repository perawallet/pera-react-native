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

import { type ReactNode, useLayoutEffect } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseScreenHeaderOptions = {
    left?: Nullable<ReactNode>
    right?: Nullable<ReactNode>
    title?: ReactNode | string
    enabled?: boolean
}

export const useNavigationHeader = ({
    left,
    right,
    title,
    enabled = true,
}: UseScreenHeaderOptions): void => {
    const navigation = useNavigation()

    useLayoutEffect(() => {
        if (!enabled) return

        const options: Record<string, unknown> = {}

        if (left !== undefined) {
            options.headerLeft = left === null ? undefined : () => left
        }
        if (right !== undefined) {
            options.headerRight = right === null ? undefined : () => right
        }
        if (title !== undefined) {
            if (typeof title === 'string') {
                options.title = title
            } else {
                options.headerTitle = () => title
            }
        }

        navigation.setOptions(options)
    }, [enabled, left, right, title, navigation])
}
