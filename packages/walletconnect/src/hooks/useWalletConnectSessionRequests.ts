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

import { useCallback } from 'react'
import { WalletConnectSessionRequest } from '../models'
import { useWalletConnectStore } from '../store'

export const useWalletConnectSessionRequests = () => {
    const sessionRequests = useWalletConnectStore(
        state => state.sessionRequests,
    )
    const setSessionRequests = useWalletConnectStore(
        state => state.setSessionRequests,
    )

    const addSessionRequest = useCallback(
        (request: WalletConnectSessionRequest) => {
            setSessionRequests([...sessionRequests, request])
        },
        [sessionRequests],
    )

    const removeSessionRequest = useCallback(
        (request: WalletConnectSessionRequest) => {
            setSessionRequests(sessionRequests.filter(r => r !== request))
        },
        [sessionRequests],
    )

    return {
        sessionRequests,
        addSessionRequest,
        removeSessionRequest,
    }
}
