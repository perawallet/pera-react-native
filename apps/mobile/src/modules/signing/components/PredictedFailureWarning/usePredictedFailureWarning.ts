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

import { useEffect } from 'react'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import {
    usePredictedFailureGate,
    usePredictedFailureFlagStore,
    type UsePredictedFailureGateResult,
} from '../../hooks/usePredictedFailureGate'

/** Flags the current request while the warning is mounted, so Confirm waits on the acknowledgement. */
export const usePredictedFailureWarning = (): Pick<
    UsePredictedFailureGateResult,
    'isAcknowledged' | 'toggleAcknowledged'
> => {
    const { currentRequest } = useSigningRequest()
    const requestId = currentRequest?.id
    const setFlaggedRequestId = usePredictedFailureFlagStore(
        state => state.setFlaggedRequestId,
    )
    const { isAcknowledged, toggleAcknowledged } = usePredictedFailureGate()

    useEffect(() => {
        if (!requestId) return
        setFlaggedRequestId(requestId)
        return () => {
            // A newer request may have flagged itself by now.
            if (
                usePredictedFailureFlagStore.getState().flaggedRequestId ===
                requestId
            ) {
                setFlaggedRequestId(undefined)
            }
        }
    }, [requestId, setFlaggedRequestId])

    return { isAcknowledged, toggleAcknowledged }
}
