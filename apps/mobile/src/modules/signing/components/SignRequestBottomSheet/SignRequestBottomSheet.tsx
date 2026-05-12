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

import React, { useEffect } from 'react'
import { PWBottomSheet } from '@components/core'
import { SignRequestView } from '@modules/signing/components/SignRequestView'
import { useSigningRequest } from '@perawallet/wallet-core-signing'
import { deferToNextCycle } from '@perawallet/wallet-core-shared'

export function SignRequestBottomSheet() {
    const { pendingSignRequests, lastCompletedRequest } = useSigningRequest()
    // Headless requests run signing in the background without any user-facing
    // UI — the originating screen (e.g. swap) drives its own confirmation.
    //
    // Also skip a request whose id is the one we just completed. Without
    // this guard, there is a one-tick window between (a) the actor reaching
    // `completed` / publishing `lastCompletedRequest` and (b) the request
    // being removed from `pendingSignRequests`, during which `nextRequest`
    // still resolves to the completed request and the modal renders with
    // an empty body (the SigningRoutes inside SignRequestView unmount as
    // the actor tears down) — visible to the user as a blank bottom sheet
    // stacked over PendingSignaturesBottomSheet for multisig cosign.
    const nextRequest = pendingSignRequests.find(
        r => !r.headless && r.id !== lastCompletedRequest?.id,
    )
    const [isVisible, setIsVisible] = React.useState(false)

    useEffect(() => {
        setIsVisible(false)
        if (nextRequest && !lastCompletedRequest) {
            // we defer here to force the bottom sheet to close and reopen, as a visual cue
            // to the user that it's a new request.
            deferToNextCycle(() => {
                setIsVisible(true)
            })
        }
    }, [lastCompletedRequest, nextRequest])

    return (
        <PWBottomSheet
            // Gate on `nextRequest` to defend against a deferred
            // setIsVisible(true) firing after the request has been pulled
            // from the queue (e.g. WC error path that auto-dismisses) —
            // without this guard the sheet sticks around with empty content.
            isVisible={isVisible && !!nextRequest}
            size='lg'
            autoCreateContainer={false}
            enablePanDownToClose={false}
            enableCloseOnBackdropPress={false}
        >
            {!!nextRequest && <SignRequestView request={nextRequest} />}
        </PWBottomSheet>
    )
}
