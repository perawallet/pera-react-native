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

// Runs the authenticator core for the passkey-create / passkey-get approval
// kinds. The "resolve" here isn't a plain user decision but the output of a
// real WebAuthn ceremony, so this does its own deserialize -> sign ->
// resolvePasskey plumbing rather than reusing useDappRequest's generic
// approve()/reject(), which only post `resolve-approval`/`reject-approval`.
//
// Executes in the approval PAGE under VaultGate, never the service worker: the
// SW has no WebAuthn or keystore access, and only here is the keystore
// unlocked.
import { useCallback, useState } from 'react'
import {
    assertCredential,
    createCredential,
    deserializeCreateOptions,
    deserializeGetOptions,
} from '@perawallet/wallet-core-passkeys'
import { createKeystoreSigner } from '@perawallet/wallet-extension-keystore-chrome'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import {
    rejectPasskey,
    resolvePasskey,
    type PendingApproval,
} from '@perawallet/wallet-extension-platform-chrome'
import { useLanguage } from '@hooks/useLanguage'
import { useDappRequest } from '../../hooks/useDappRequest'

type PasskeyPendingApproval = Extract<
    PendingApproval,
    { kind: 'passkey-create' | 'passkey-get' }
>

const asPasskeyApproval = (
    approval: PendingApproval | null,
): PasskeyPendingApproval | null => {
    if (
        approval &&
        (approval.kind === 'passkey-create' || approval.kind === 'passkey-get')
    ) {
        return approval
    }
    return null
}

type UsePasskeyApprovalResult = {
    isLoading: boolean
    isCreate: boolean
    rpId: string
    userName?: string
    origin: string
    isBusy: boolean
    error: string | null
    approve: () => Promise<void>
    decline: () => Promise<void>
}

export const usePasskeyApproval = (): UsePasskeyApprovalResult => {
    const { requestId, approval, isLoading } = useDappRequest()
    const { t } = useLanguage()
    const [isBusy, setIsBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const passkeyApproval = asPasskeyApproval(approval)

    const approve = useCallback(async (): Promise<void> => {
        const current = asPasskeyApproval(approval)
        if (!requestId || !current) return
        setIsBusy(true)
        setError(null)
        // CRITICAL: `current.origin` is the browser-stamped frame origin the
        // service worker read off `chrome.runtime.MessageSender` —
        // never a value asserted by the intercepted page itself. Passing
        // anything else here would let a malicious page register/assert a
        // credential under an `rp.id` it doesn't own (see SigningContext's
        // doc in the authenticator core).
        const context = { origin: current.origin }
        try {
            const signer = createKeystoreSigner(getKeystoreStore())
            const credential =
                current.kind === 'passkey-create'
                    ? await createCredential(
                          deserializeCreateOptions(current.options),
                          signer,
                          context,
                      )
                    : await assertCredential(
                          deserializeGetOptions(current.options),
                          signer,
                          context,
                      )
            await resolvePasskey(requestId, credential)
            window.close()
        } catch (e) {
            // Never leave the dapp's request unsettled: an authenticator
            // failure (SecurityError, InvalidStateError, NotAllowedError, …)
            // still gets a terminal reject, carrying the error's name so
            // the content script can reject the page's
            // navigator.credentials promise with the matching native
            // DOMException instead of a generic cancellation.
            const reason = e instanceof Error ? e.name : 'UnknownError'
            setError(t('dapp.passkey.error'))
            await rejectPasskey(requestId, reason)
        } finally {
            setIsBusy(false)
        }
    }, [requestId, approval, t])

    const decline = useCallback(async (): Promise<void> => {
        if (!requestId) return
        await rejectPasskey(requestId, 'declined')
        window.close()
    }, [requestId])

    return {
        isLoading: isLoading || !passkeyApproval,
        isCreate: passkeyApproval?.kind === 'passkey-create',
        rpId: passkeyApproval?.rpId ?? '',
        userName: passkeyApproval?.userName,
        origin: passkeyApproval?.origin ?? '',
        isBusy,
        error,
        approve,
        decline,
    }
}
