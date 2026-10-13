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

import { toEnumValue, toEnumValueOrNull } from '@perawallet/wallet-core-shared'
import {
    CardEligibilityReason,
    CardEligibilityStatus,
    VerificationState,
    type CardUser,
} from '../../models'
import type { UserApiResponse } from './schema'

export const transformUser = (response: UserApiResponse): CardUser => ({
    id: response.id,
    firstName: response.firstName ?? undefined,
    lastName: response.lastName ?? undefined,
    email: response.email ?? undefined,
    phoneNumber: response.phoneNumber ?? undefined,
    countryOfResidence: response.countryOfResidence ?? undefined,
    // Unknown/missing state falls back to Unverified — never grant card access
    // on a state we don't recognise.
    verificationState: toEnumValue(
        VerificationState,
        response.verificationState,
        VerificationState.Unverified,
    ),
    // Null rather than a fallback: an unmodelled status or reason must not
    // masquerade as a known one, and the UI degrades to its generic copy.
    eligibilityStatus: toEnumValueOrNull(
        CardEligibilityStatus,
        response.cardEligibilityStatus,
    ),
    eligibilityReason: toEnumValueOrNull(
        CardEligibilityReason,
        response.cardEligibilityReason,
    ),
})
