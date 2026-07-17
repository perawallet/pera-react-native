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

import React from 'react'
import {
    SigningRequestScopeProvider,
    type SignRequest,
} from '@perawallet/wallet-core-signing'
import { SignRequestView } from '@modules/signing/components/SignRequestView'

export type SignRequestContentProps = {
    request: SignRequest
}

/**
 * Renders the sign-request UI inside a bottom sheet. The sheet itself is
 * driven by `useSignRequestDriver` in `SigningOverlays`, which watches the
 * signing queue and calls `requestBottomSheet` whenever a new request
 * whose `sourceType` is in `INTERACTIVE_SOURCES` appears.
 *
 * The scope provider binds every signing hook rendered inside the sheet
 * (`useSigningPipeline`, action buttons, the signing screens) to THIS
 * request — never to whatever currently sits at the queue head, which can
 * be a different request while a headless hardware sign is in flight.
 */
export const SignRequestContent = ({ request }: SignRequestContentProps) => (
    <SigningRequestScopeProvider requestId={request.id}>
        <SignRequestView request={request} />
    </SigningRequestScopeProvider>
)
