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

import {
    dobToIsoDate,
    ssnToApi,
    type PersonalDetailsFormValues,
    type PersonalDetailsInput,
} from '@perawallet/wallet-core-card'

/** Maps the form to the request, leaving out what Baanx didn't ask for. */
export const toPersonalDetailsInput = (
    values: PersonalDetailsFormValues,
    {
        onboardingId,
        isUsResident,
        isPortugalResident,
    }: {
        onboardingId: string
        isUsResident: boolean
        isPortugalResident: boolean
    },
): PersonalDetailsInput => ({
    onboardingId,
    firstName: values.firstName,
    ...(values.middleName ? { middleName: values.middleName } : {}),
    lastName: values.lastName,
    dateOfBirth: dobToIsoDate(values.dateOfBirth),
    countryOfNationality: values.countryOfNationality,
    countryOfBirth: values.countryOfBirth,
    ...(values.additionalNationalities.length
        ? { additionalNationalities: values.additionalNationalities }
        : {}),
    ...(isPortugalResident
        ? { portugalInvestmentScheme: values.portugalInvestmentScheme }
        : {}),
    ...(values.employmentStatus
        ? { employmentStatus: values.employmentStatus }
        : {}),
    ...(values.employmentSector
        ? { employmentSector: values.employmentSector }
        : {}),
    ssn: isUsResident ? ssnToApi(values.ssn) : undefined,
})
