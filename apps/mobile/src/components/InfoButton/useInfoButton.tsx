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

import { type ReactNode, useCallback, useRef } from 'react'
import { useBottomSheet } from '@modules/bottom-sheet'
import { InfoButtonContent } from './InfoButtonContent'

export type UseInfoButtonParams = {
    title?: string
    children: ReactNode
}

export type UseInfoButtonResult = {
    openInfo: () => void
}

export const useInfoButton = ({
    title,
    children,
}: UseInfoButtonParams): UseInfoButtonResult => {
    const { request } = useBottomSheet()

    const latest = useRef({ title, children, request })
    latest.current = { title, children, request }

    const openInfo = useCallback(() => {
        const current = latest.current
        void current.request<void>({
            contents: (
                <InfoButtonContent title={current.title}>
                    {current.children}
                </InfoButtonContent>
            ),
            options: { size: 'auto', enablePanDownToClose: true },
        })
    }, [])

    return { openInfo }
}
