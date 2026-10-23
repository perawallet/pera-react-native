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
import type { SupportedCountry } from '@perawallet/wallet-core-card'
import { useBottomSheet } from '@modules/bottom-sheet'
import { CardCountryPickerContent } from '../components/CardCountryPicker'

export type UseRepeatedCountryFieldParams = {
    max: number
    /** Title of the country picker sheet. */
    pickerTitle: string
    /** Called with the full list after every change, e.g. to mirror it into a form. */
    onChange: (countries: SupportedCountry[]) => void
}

export type UseRepeatedCountryFieldResult = {
    countries: SupportedCountry[]
    canAdd: boolean
    handleAdd: () => void
    handleChange: (index: number) => void
    handleRemove: (index: number) => void
    /** Replaces the list without the picker, e.g. to prefill it. */
    setCountries: (countries: SupportedCountry[]) => void
}

/** A list of up to `max` countries, each picked from the country sheet. */
export const useRepeatedCountryField = ({
    max,
    pickerTitle,
    onChange,
}: UseRepeatedCountryFieldParams): UseRepeatedCountryFieldResult => {
    const { request } = useBottomSheet()
    const [countries, setState] = useState<SupportedCountry[]>([])

    const setCountries = useCallback(
        (next: SupportedCountry[]) => {
            setState(next)
            onChange(next)
        },
        [onChange],
    )

    const pickCountry = useCallback(
        () =>
            request<SupportedCountry>({
                contents: createElement(CardCountryPickerContent, {
                    title: pickerTitle,
                }),
                // The picker owns a scrollable list, so it manages its own
                // layout; `false` gives that list a bounded height to scroll.
                options: { size: 'full', autoCreateContainer: false },
            }),
        [request, pickerTitle],
    )

    const handleAdd = useCallback(() => {
        void (async () => {
            const country = await pickCountry()
            if (country) setCountries([...countries, country])
        })()
    }, [pickCountry, setCountries, countries])

    const handleChange = useCallback(
        (index: number) => {
            void (async () => {
                const country = await pickCountry()
                if (!country) return
                setCountries(
                    countries.map((current, position) =>
                        position === index ? country : current,
                    ),
                )
            })()
        },
        [pickCountry, setCountries, countries],
    )

    const handleRemove = useCallback(
        (index: number) => {
            setCountries(
                countries.filter((_country, position) => position !== index),
            )
        },
        [setCountries, countries],
    )

    return {
        countries,
        canAdd: countries.length < max,
        handleAdd,
        handleChange,
        handleRemove,
        setCountries,
    }
}
