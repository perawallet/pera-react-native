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

import { useCallback, useMemo, useRef, useState, type RefObject } from 'react'

import type { PWSheetLayoutScrollHandle } from '@components/core'

export type UsePassphraseAcknowledgeContentParams = {
    rowCount: number
}

export type UsePassphraseAcknowledgeContentResult = {
    checked: boolean[]
    allChecked: boolean
    toggle: (index: number) => void
    scrollRef: RefObject<PWSheetLayoutScrollHandle | null>
}

const buildInitialChecked = (rowCount: number): boolean[] =>
    Array.from({ length: rowCount }, () => false)

export const usePassphraseAcknowledgeContent = ({
    rowCount,
}: UsePassphraseAcknowledgeContentParams): UsePassphraseAcknowledgeContentResult => {
    const [checked, setChecked] = useState<boolean[]>(() =>
        buildInitialChecked(rowCount),
    )
    const scrollRef = useRef<PWSheetLayoutScrollHandle>(null)

    const allChecked = useMemo(
        () => checked.length === rowCount && checked.every(Boolean),
        [checked, rowCount],
    )

    const toggle = useCallback(
        (index: number) => {
            const isChecking = !checked[index]
            setChecked(previous =>
                previous.map((value, i) => (i === index ? !value : value)),
            )
            // On short viewports (the extension popup) the last rows sit below
            // the fold with no scroll cue; the rows end the body, so scrolling
            // to the end reveals whatever is still unticked.
            if (isChecking && checked.slice(index + 1).some(value => !value)) {
                scrollRef.current?.scrollToEnd({ animated: true })
            }
        },
        [checked],
    )

    return { checked, allChecked, toggle, scrollRef }
}
