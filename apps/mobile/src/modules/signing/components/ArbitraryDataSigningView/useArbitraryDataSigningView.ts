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

import {
    type ArbitraryDataSignRequest,
    useSigningRequest,
} from '../../../../../../../packages/signing/dist'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'
import { useCallback, useState } from 'react'

export const useArbitraryDataSigningView = (
    request: ArbitraryDataSignRequest,
) => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const [isPending, setIsPending] = useState(false)

    const { signAndSendRequest, rejectRequest: coreRejectRequest } =
        useSigningRequest()

    const approveRequest = useCallback(async () => {
        setIsPending(true)
        try {
            await signAndSendRequest(request)
            showToast({
                title: t('signing.arbitrary_data_view.success_title'),
                body: t('signing.arbitrary_data_view.success_body'),
                type: 'success',
            })
        } catch (error) {
            await request.error?.(`${error}`)
        } finally {
            setIsPending(false)
        }
    }, [request, signAndSendRequest, showToast, t])

    const rejectRequest = useCallback(() => {
        coreRejectRequest(request)
    }, [request, coreRejectRequest])

    return {
        approveRequest,
        rejectRequest,
        isPending,
    }
}
