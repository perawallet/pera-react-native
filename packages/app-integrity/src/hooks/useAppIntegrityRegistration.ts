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

import { useCallback, useState } from 'react'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import {
    registerAppIntegrity,
    type RegisterAppIntegrityResult,
} from '../services/registerAppIntegrity'

export type UseAppIntegrityRegistrationResult = {
    register: () => Promise<RegisterAppIntegrityResult>
    isRegistering: boolean
}

/**
 * Triggers the attestation handshake against the wallet mode's deployment and
 * tracks whether a run is in flight. The persisted result is exposed via useAppIntegrityStore.
 */
export const useAppIntegrityRegistration =
    (): UseAppIntegrityRegistrationResult => {
        const deployment = useNetworkStore(state => state.mode)
        const [isRegistering, setIsRegistering] = useState(false)

        const register = useCallback(async () => {
            setIsRegistering(true)
            try {
                return await registerAppIntegrity({ deployment })
            } finally {
                setIsRegistering(false)
            }
        }, [deployment])

        return { register, isRegistering }
    }
