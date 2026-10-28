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

import type { SignRequest } from '@perawallet/wallet-core-signing'
import {
    useSiteSafetyGate,
    type UseSiteSafetyGateResult,
} from '@modules/site-safety'

/** Checked on every request, so a site listed after it connected is caught at its next one. */
export const useSignRequestSiteSafety = (
    request: SignRequest,
): UseSiteSafetyGateResult => {
    const verification = request.sourceMetadata?.verification
    return useSiteSafetyGate({
        urls: [
            request.sourceMetadata?.url,
            request.verifiedOrigin,
            verification?.verifiedOrigin,
        ],
        isFlaggedByWalletConnectVerify: verification?.status === 'scam',
    })
}
