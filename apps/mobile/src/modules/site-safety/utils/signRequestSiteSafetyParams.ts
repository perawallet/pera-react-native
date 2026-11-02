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
import type { AssessSiteSafetyParams } from '@perawallet/wallet-core-site-safety'

/** Shared by the sign gate and the review so both read the same cached verdict. */
export const signRequestSiteSafetyParams = (
    request: SignRequest,
): AssessSiteSafetyParams => {
    const verification = request.sourceMetadata?.verification
    return {
        urls: [
            request.sourceMetadata?.url,
            request.verifiedOrigin,
            verification?.verifiedOrigin,
        ],
        isFlaggedByWalletConnectVerify: verification?.status === 'scam',
    }
}
