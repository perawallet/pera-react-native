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

import { createElement, useCallback, useState } from 'react'
import type {
    RegistrationOption,
    RegistrationOptionList,
} from '@perawallet/wallet-core-card'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { CardOptionPickerContent } from '../components/CardOptionPicker'

export type UseCardOptionFieldParams = {
    /** Title of the picker sheet. */
    pickerTitle: string
    /** Called with the chosen option, e.g. to write its key into a form. */
    onChange: (option: RegistrationOption) => void
} & (
    | { list: RegistrationOptionList; options?: undefined }
    /** A short fixed set the app owns, picked without search. */
    | { options: RegistrationOption[]; list?: undefined }
)

export type UseCardOptionFieldResult = {
    selected: Optional<RegistrationOption>
    handleSelect: () => void
    /** Sets the choice without the picker, e.g. to prefill it. */
    setSelected: (option: RegistrationOption) => void
}

/** One `{ key, name }` choice, from a GET /v1/auth/settings list or a fixed set. */
export const useCardOptionField = ({
    list,
    options,
    pickerTitle,
    onChange,
}: UseCardOptionFieldParams): UseCardOptionFieldResult => {
    const { request } = useBottomSheet()
    const [selected, setState] =
        useState<Optional<RegistrationOption>>(undefined)

    const setSelected = useCallback(
        (option: RegistrationOption) => {
            setState(option)
            onChange(option)
        },
        [onChange],
    )

    const handleSelect = useCallback(() => {
        void (async () => {
            const option = await request<RegistrationOption>({
                contents: createElement(
                    CardOptionPickerContent,
                    list === undefined
                        ? { title: pickerTitle, options }
                        : { title: pickerTitle, list },
                ),
                options: { size: 'full', autoCreateContainer: false },
            })
            if (option) setSelected(option)
        })()
    }, [request, pickerTitle, list, options, setSelected])

    return { selected, handleSelect, setSelected }
}
