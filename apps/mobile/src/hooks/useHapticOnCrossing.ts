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

import { useEffect, useRef } from 'react'

// The ref starts false so a surface that mounts already past its threshold
// (a price-impact sheet opened on a high-impact quote) still counts as a crossing.
export const useHapticOnCrossing = (
    isCrossed: boolean,
    play: () => void,
): void => {
    const wasCrossedRef = useRef(false)
    const playRef = useRef(play)
    playRef.current = play

    useEffect(() => {
        if (isCrossed && !wasCrossedRef.current) playRef.current()
        wasCrossedRef.current = isCrossed
    }, [isCrossed])
}
