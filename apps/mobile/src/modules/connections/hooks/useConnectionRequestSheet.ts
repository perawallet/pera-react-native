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
import { generateUniqueId, type Nullable } from '@perawallet/wallet-core-shared'
import { type BottomSheetOptions, useBottomSheet } from '@modules/bottom-sheet'

export type UseConnectionRequestSheetParams = {
    /** Whether the request sheet should currently be presented. */
    shouldShow: boolean
    /** Built once, at open time — the bottom-sheet contract fixes props on request. */
    renderContents: () => ReactNode
    options?: BottomSheetOptions
}

const DEFAULT_OPTIONS: BottomSheetOptions = {
    size: 'lg',
    autoCreateContainer: false,
}

/**
 * Drives a single imperative request sheet (the pre-connection approval /
 * connecting sheet) from a boolean: opens it (by id) when `shouldShow` turns
 * true and dismisses it when it turns false. Reacts only to `shouldShow` — the
 * sheet's contents are captured once at open time, so re-running on unrelated
 * state changes would re-open a stale sheet.
 */
export const useConnectionRequestSheet = ({
    shouldShow,
    renderContents,
    options,
}: UseConnectionRequestSheetParams): void => {
    const { request, dismiss } = useBottomSheet()
    const idRef = useRef<Nullable<string>>(null)
    const renderRef = useRef(renderContents)
    renderRef.current = renderContents
    const optionsRef = useRef(options)
    optionsRef.current = options

    useEffect(() => {
        if (shouldShow && !idRef.current) {
            const id = generateUniqueId()
            idRef.current = id
            void request({
                id,
                contents: renderRef.current(),
                options: optionsRef.current ?? DEFAULT_OPTIONS,
            }).finally(() => {
                idRef.current = null
            })
        } else if (!shouldShow && idRef.current) {
            const id = idRef.current
            idRef.current = null
            dismiss(id)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shouldShow])
}
