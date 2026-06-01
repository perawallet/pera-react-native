/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import {
    registerAppIntegrity,
    type RegisterAppIntegrityResult,
} from './registerAppIntegrity'

export type UseAppIntegrityRegistrationResult = {
    register: () => Promise<RegisterAppIntegrityResult>
    isRegistering: boolean
}

/**
 * Triggers the attestation handshake for the active network and tracks whether
 * a run is in flight. The persisted result is exposed via useAppIntegrityStore.
 */
export const useAppIntegrityRegistration =
    (): UseAppIntegrityRegistrationResult => {
        const { network } = useNetwork()
        const [isRegistering, setIsRegistering] = useState(false)

        const register = useCallback(async () => {
            setIsRegistering(true)
            try {
                return await registerAppIntegrity({ network })
            } finally {
                setIsRegistering(false)
            }
        }, [network])

        return { register, isRegistering }
    }
