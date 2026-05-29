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

import { type ReactNode, useEffect, useRef } from 'react'
import { useBottomSheet } from '@modules/bottom-sheet'

export type UseConnectionResultSheetParams = {
    /** Whether the result (success / error) sheet should be presented. */
    isActive: boolean
    /** Built once, when the sheet opens. */
    renderContents: () => ReactNode
    /** Run once the user dismisses the sheet — clear the state that drove it. */
    onClose: () => void
}

/**
 * Drives a terminal result sheet (connection success or error) from a boolean.
 * Opens the auto-height sheet once when `isActive` turns true, awaits the user
 * dismissing it, then runs `onClose` to clear the driving state. A re-entry
 * guard keeps a single sheet in flight; `onClose`/`renderContents` are read
 * from refs so the latest closures run without re-triggering the effect.
 */
export const useConnectionResultSheet = ({
    isActive,
    renderContents,
    onClose,
}: UseConnectionResultSheetParams): void => {
    const { request } = useBottomSheet()
    const openRef = useRef(false)
    const renderRef = useRef(renderContents)
    renderRef.current = renderContents
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    useEffect(() => {
        if (!isActive || openRef.current) return
        openRef.current = true
        let cancelled = false
        void (async () => {
            await request<void>({
                contents: renderRef.current(),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (cancelled) return
            openRef.current = false
            onCloseRef.current()
        })()
        return () => {
            cancelled = true
        }
    }, [isActive, request])
}
