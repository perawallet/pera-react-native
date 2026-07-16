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

import { useMutation } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { sendLoginOtpRequest } from '../api/auth'
import { toCardMutationResult, type CardMutationResult } from './types'

export type SendLoginOtpParams = {
    /** `userId` from the login attempt that came back `isOtpRequired`. */
    userId: string
}

export type UseSendLoginOtpMutationResult =
    CardMutationResult<SendLoginOtpParams>

/**
 * Asks Baanx to send the login 2FA code. Baanx does not send it on its own —
 * call this when login returns `isOtpRequired` (and again on "resend"), then
 * retry the login with the user-entered `otpCode`.
 */
export const useSendLoginOtpMutation = (): UseSendLoginOtpMutationResult => {
    const { network } = useNetwork()

    const mutation = useMutation<void, Error, SendLoginOtpParams>({
        mutationFn: ({ userId }) => sendLoginOtpRequest({ userId, network }),
        throwOnError: false,
    })

    return toCardMutationResult(mutation)
}
