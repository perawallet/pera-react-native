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

import { useTheme } from '@rneui/themed'
import { getInitials } from '@perawallet/wallet-core-shared'
import { getIconPixelSize } from '@components/core'

export type UseInitialsIconParams = {
    label: string
    /** px */
    size: number
}

export type UseInitialsIconResult = {
    initials: string
}

export const useInitialsIcon = ({
    label,
    size,
}: UseInitialsIconParams): UseInitialsIconResult => {
    const { theme } = useTheme()
    // Two caption letters overflow a circle smaller than the md icon, such as a chip's.
    const maxLetters = size < getIconPixelSize(theme, 'md') ? 1 : 2
    return { initials: getInitials(label, maxLetters) }
}
