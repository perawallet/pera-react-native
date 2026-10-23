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

import { createElement, useCallback, useEffect, useRef, useState } from 'react'
import type { SupportedCountry } from '@perawallet/wallet-core-card'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { useBottomSheet } from '@modules/bottom-sheet'
import { CardCountryPickerContent } from '@modules/card/components/CardCountryPicker'

export type UsePreselectedCountryFieldParams = {
    /** ISO 3166-1 alpha-2 the onboarding record already holds. */
    serverIso: Nullable<string>
    /** ISO 3166-1 alpha-2 residence, the changeable guess otherwise. */
    residenceIso: Nullable<string>
    /** The supported list from the settings; undefined while it loads. */
    countries: Optional<SupportedCountry[]>
    pickerTitle: string
    onChange: (country: SupportedCountry) => void
}

export type UsePreselectedCountryFieldResult = {
    selected: Optional<SupportedCountry>
    /** The record's value resolved against the supported list. */
    isLocked: boolean
    handleSelect: () => void
}

/**
 * A country field preselected once from the record, else the residence. It
 * locks only when the record's value resolves: one the list doesn't contain
 * (e.g. read off the KYC scan) must stay editable, or the field would be empty
 * and locked with no way to submit.
 */
export const usePreselectedCountryField = ({
    serverIso,
    residenceIso,
    countries,
    pickerTitle,
    onChange,
}: UsePreselectedCountryFieldParams): UsePreselectedCountryFieldResult => {
    const { request } = useBottomSheet()
    const [selected, setSelected] = useState<Optional<SupportedCountry>>()
    const hasPreselected = useRef(false)

    const find = (iso: Nullable<string>) =>
        iso
            ? countries?.find(country => country.iso3166alpha2 === iso)
            : undefined
    const serverCountry = find(serverIso)
    const residenceCountry = find(residenceIso)

    const apply = useCallback(
        (country: SupportedCountry) => {
            setSelected(country)
            onChange(country)
        },
        [onChange],
    )

    useEffect(() => {
        if (hasPreselected.current || selected) return
        const match = serverCountry ?? residenceCountry
        if (!match) return
        hasPreselected.current = true
        apply(match)
    }, [serverCountry, residenceCountry, selected, apply])

    const handleSelect = useCallback(() => {
        void (async () => {
            const country = await request<SupportedCountry>({
                contents: createElement(CardCountryPickerContent, {
                    title: pickerTitle,
                }),
                // The picker owns a scrollable list, so it manages its own
                // layout; `false` gives that list a bounded height to scroll.
                options: { size: 'full', autoCreateContainer: false },
            })
            if (country) apply(country)
        })()
    }, [request, pickerTitle, apply])

    return { selected, isLocked: Boolean(serverCountry), handleSelect }
}
