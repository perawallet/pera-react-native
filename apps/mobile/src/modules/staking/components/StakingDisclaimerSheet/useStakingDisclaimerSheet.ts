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

import { useCallback, useEffect, useState } from 'react'
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native'

const BOTTOM_THRESHOLD = 20

type UseStakingDisclaimerSheetParams = {
    isVisible: boolean
}

type UseStakingDisclaimerSheetResult = {
    isScrolledToBottom: boolean
    handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
}

export const useStakingDisclaimerSheet = ({
    isVisible,
}: UseStakingDisclaimerSheetParams): UseStakingDisclaimerSheetResult => {
    const [isScrolledToBottom, setIsScrolledToBottom] = useState(false)

    useEffect(() => {
        if (isVisible) {
            setIsScrolledToBottom(false)
        }
    }, [isVisible])

    const handleScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (isScrolledToBottom) {
                return
            }

            const { contentOffset, contentSize, layoutMeasurement } =
                event.nativeEvent
            const hasReachedBottom =
                contentOffset.y + layoutMeasurement.height >=
                contentSize.height - BOTTOM_THRESHOLD

            if (hasReachedBottom) {
                setIsScrolledToBottom(true)
            }
        },
        [isScrolledToBottom],
    )

    return {
        isScrolledToBottom,
        handleScroll,
    }
}
