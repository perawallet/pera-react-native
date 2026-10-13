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

import { useCallback } from 'react'
import type { BridgeHandler } from './types'

type UseHostNavigationHandlersParams = {
    onCloseRequested?: () => void
    onBackRequested?: () => void
}

type UseHostNavigationHandlersResult = {
    onBackPressed: BridgeHandler
    closeWebView: BridgeHandler
}

export const useHostNavigationHandlers = ({
    onCloseRequested,
    onBackRequested,
}: UseHostNavigationHandlersParams): UseHostNavigationHandlersResult => {
    const onBackPressed = useCallback<BridgeHandler>(() => {
        onBackRequested?.()
    }, [onBackRequested])

    const closeWebView = useCallback<BridgeHandler>(() => {
        onCloseRequested?.()
    }, [onCloseRequested])

    return { onBackPressed, closeWebView }
}
