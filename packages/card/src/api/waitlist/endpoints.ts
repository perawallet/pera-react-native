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

import { queryClient } from '@perawallet/wallet-core-shared'
import type { Network } from '@perawallet/wallet-core-shared'

/** Pera-backend request body (snake_case), unlike the camelCase Baanx bodies. */
type CountryAvailabilityRequestBody = {
    alpha_2_country_code: string
    device: string
}

export type RequestCountryAvailabilityParams = {
    network: Network
    /** ISO 3166-1 alpha-2 of the unsupported country the user picked. */
    countryCode: string
    deviceId: string
    signal?: AbortSignal
}

/**
 * Adds the device to the waitlist for an unsupported jurisdiction. This hits
 * Pera's own backend (not Baanx), so it goes through the shared `queryClient`
 * rather than the Baanx-only card transport seam. The backend records the
 * request and later notifies the device via push when the country launches.
 */
export const requestCountryAvailability = async (
    params: RequestCountryAvailabilityParams,
): Promise<void> => {
    await queryClient<void, CountryAvailabilityRequestBody>({
        backend: 'pera',
        network: params.network,
        method: 'POST',
        url: 'v1/cards/country-availability-request/',
        data: {
            alpha_2_country_code: params.countryCode,
            device: params.deviceId,
        },
        signal: params.signal,
    })
}
