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

import { useEffect, useState } from 'react'
import { EXPANDABLE_PANEL_ANIMATION_DURATION } from '@constants/ui'

export type UseExpandableAssetGroupParams = {
    isExpanded: boolean
}

export type UseExpandableAssetGroupResult = {
    shouldRenderMembers: boolean
}

export const useExpandableAssetGroup = ({
    isExpanded,
}: UseExpandableAssetGroupParams): UseExpandableAssetGroupResult => {
    const [wasExpanded, setWasExpanded] = useState(isExpanded)
    const [isCollapsing, setIsCollapsing] = useState(false)

    // Set during render, so the members are still there on the frame the
    // collapse starts.
    if (wasExpanded !== isExpanded) {
        setWasExpanded(isExpanded)
        setIsCollapsing(!isExpanded)
    }

    // Timed rather than on the panel's completion callback, which a stalled UI
    // thread can hold back and the test runtime's reanimated never calls.
    useEffect(() => {
        if (!isCollapsing) return
        const timer = setTimeout(
            () => setIsCollapsing(false),
            EXPANDABLE_PANEL_ANIMATION_DURATION,
        )
        return () => clearTimeout(timer)
    }, [isCollapsing])

    return { shouldRenderMembers: isExpanded || isCollapsing }
}
