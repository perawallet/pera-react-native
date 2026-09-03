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
import { AppState } from 'react-native'
import { Image } from 'expo-image'
import { isBackgroundTransition } from '@utils/app-state'

/**
 * Drops decoded bitmaps when the app leaves the foreground. Play measures
 * bitmap memory retained in background and cached states, and PWImage's
 * `memory-disk` default otherwise keeps them resident for the whole session.
 * Only the memory cache goes — the disk cache still backs a resume, so images
 * re-decode from local storage rather than refetching over the network.
 */
export const useImageMemoryRelease = (): void => {
    const previousState = useRef(AppState.currentState)

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextState => {
            const didLeaveForeground = isBackgroundTransition(
                previousState.current,
                nextState,
            )
            previousState.current = nextState

            if (didLeaveForeground) void Image.clearMemoryCache()
        })

        return () => subscription.remove()
    }, [])
}
