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
import type { UseFormSetValue } from 'react-hook-form'
import {
    isoDateToDob,
    type OnboardingDetails,
    type PersonalDetailsFormValues,
    type SupportedCountry,
} from '@perawallet/wallet-core-card'
import type { Optional } from '@perawallet/wallet-core-shared'

export type UsePersonalDetailsPrefillParams = {
    record: Optional<OnboardingDetails>
    countries: Optional<SupportedCountry[]>
    maxExtraNationalities: number
    setValue: UseFormSetValue<PersonalDetailsFormValues>
    setExtraNationalities: (countries: SupportedCountry[]) => void
}

/**
 * Prefills the form once from the onboarding record, only for what it holds,
 * so a fresh registration stays empty. Extra nationalities and the Portugal
 * answer stay editable: a second submit updates them.
 */
export const usePersonalDetailsPrefill = ({
    record,
    countries,
    maxExtraNationalities,
    setValue,
    setExtraNationalities,
}: UsePersonalDetailsPrefillParams): void => {
    const hasPrefilledText = useRef(false)
    useEffect(() => {
        if (hasPrefilledText.current || !record) return
        const { firstName, lastName, dateOfBirth } = record
        if (!firstName && !lastName && !dateOfBirth) return
        hasPrefilledText.current = true
        if (firstName)
            setValue('firstName', firstName, { shouldValidate: true })
        if (lastName) setValue('lastName', lastName, { shouldValidate: true })
        if (dateOfBirth) {
            setValue('dateOfBirth', isoDateToDob(dateOfBirth), {
                shouldValidate: true,
            })
        }
    }, [record, setValue])

    const hasPrefilledChoices = useRef(false)
    useEffect(() => {
        if (hasPrefilledChoices.current || !record || !countries?.length) return
        hasPrefilledChoices.current = true
        const extra = record.additionalNationalities
            .map(iso =>
                countries.find(country => country.iso3166alpha2 === iso),
            )
            .filter(
                (country): country is SupportedCountry => country !== undefined,
            )
            .slice(0, maxExtraNationalities)
        if (extra.length) setExtraNationalities(extra)
        if (record.portugalInvestmentScheme !== null) {
            setValue(
                'portugalInvestmentScheme',
                record.portugalInvestmentScheme,
            )
        }
    }, [
        record,
        countries,
        maxExtraNationalities,
        setValue,
        setExtraNationalities,
    ])
}
