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

import { useCallback } from 'react'
import { FeeDelegationAttestationRequiredError } from '../fee-delegation'
import {
    RampAttestationRequiredError,
    type EnsureCanReceive,
    type EnsureCanReceiveParams,
} from '@perawallet/wallet-core-onramp'
import { useEnsureAssetOptIn } from '../swaps/useEnsureSwapAssetOptIn'

export type UseEnsureDestinationOptInResult = {
    ensureOptIn: EnsureCanReceive
}

const SOURCE = {
    name: 'onramp-opt-in',
    description: 'Opt in to the destination asset before funding',
}

/**
 * Ensures the receiving account is opted into the destination asset before an
 * onramp order is created. An opt-in runs the `confirm` gate first when
 * provided; a sponsored one needs a valid device attestation token, and throws
 * the onramp's `RampAttestationRequiredError` otherwise.
 */
export const useEnsureDestinationOptIn =
    (): UseEnsureDestinationOptInResult => {
        const ensureAssetOptIn = useEnsureAssetOptIn()

        const ensureOptIn = useCallback(
            async ({
                address,
                scope,
                assetId,
                confirm,
            }: EnsureCanReceiveParams): Promise<boolean> => {
                try {
                    return await ensureAssetOptIn({
                        address,
                        scope,
                        assetId,
                        confirm,
                        sourceMetadata: SOURCE,
                    })
                } catch (error) {
                    if (
                        error instanceof FeeDelegationAttestationRequiredError
                    ) {
                        throw new RampAttestationRequiredError()
                    }
                    throw error
                }
            },
            [ensureAssetOptIn],
        )

        return { ensureOptIn }
    }
