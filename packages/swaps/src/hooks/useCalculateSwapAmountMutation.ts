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

import { useMutation } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceID } from '@perawallet/wallet-core-device'
import { calculateSwapAmount } from '../api'
import type { CalculateSwapAmountRequest } from '../api'

export const useCalculateSwapAmountMutation = () => {
    const { network } = useNetwork()
    // Ambient like `network`, so it is injected here rather than threaded
    // through callers.
    const deviceId = useDeviceID(network)

    return useMutation({
        // Omitted, not sent as null, while the device is unregistered: `device`
        // is newly optional on this endpoint, and a serializer that tolerates
        // omission can still reject an explicit null. Percentage/MAX must keep
        // working on a fresh install, where the id is not there yet.
        mutationFn: (data: Omit<CalculateSwapAmountRequest, 'device'>) =>
            calculateSwapAmount(
                { ...data, ...(deviceId ? { device: deviceId } : {}) },
                network,
            ),
        // Handled by the caller — opt out of the global throwOnError default.
        throwOnError: false,
    })
}
