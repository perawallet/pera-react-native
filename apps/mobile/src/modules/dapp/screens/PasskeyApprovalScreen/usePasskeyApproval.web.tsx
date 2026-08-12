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
import {
    createKeystoreSigner,
    type PasskeyKeyStore,
} from '@perawallet/wallet-extension-keystore-chrome'
import {
    getKeystore,
    getKeystoreStore,
} from '@perawallet/wallet-extension-provider'
import {
    rejectPasskey,
    resolvePasskey,
    type PendingApproval,
} from '@perawallet/wallet-extension-platform-chrome'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useRequireVaultPassword } from '@modules/vault'
import {
    PasskeyChooserContent,
    type PasskeyChoice,
} from '../../components/PasskeyChooserContent'
import { useLanguage } from '@hooks/useLanguage'
import { useDappRequest } from '../../hooks/useDappRequest.web'

/**
 * Whether the relying party demanded user verification for this ceremony.
 *
 * We prompt only for `'required'`. `'preferred'` is an explicit statement that
 * the RP will accept an unverified assertion, so making every passkey sign-in
 * carry a password prompt would be friction the RP didn't ask for — and the UV
 * bit stays off in that case, which is the honest report. `'discouraged'`
 * obviously never prompts. Absent means `'preferred'` per WebAuthn L3 §5.5.
 */
const requiresUserVerification = (
    approval: PasskeyPendingApproval,
): boolean => {
    if (approval.kind === 'passkey-get') {
        return (
            deserializeGetOptions(approval.options).userVerification ===
            'required'
        )
    }
    return (
        deserializeCreateOptions(approval.options).authenticatorSelection
            ?.userVerification === 'required'
    )
}

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
    const { requireVaultPassword } = useRequireVaultPassword()
    const { request: requestBottomSheet } = useBottomSheet()
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
        // A button press is user PRESENCE. When the RP asked for user
        // verification we must actually check a factor before claiming the UV
        // bit — mobile gets that for free from the OS credential-provider
        // ceremony (Face ID), the extension has to ask.
        let userVerified = false
        if (requiresUserVerification(current)) {
            userVerified = await requireVaultPassword(
                t('vault.reauth.passkey_description'),
            )
            if (!userVerified) {
                // Declining the check is declining the ceremony — never fall
                // through and assert with UV off, since the RP said required.
                setIsBusy(false)
                await rejectPasskey(requestId, 'NotAllowedError')
                window.close()
                return
            }
        }
        const context = {
            origin: current.origin,
            userVerified,
            // Only reached for a discoverable request with more than one
            // stored credential — the core decides when to ask (see
            // SigningContext.selectCredential). Dismissing resolves the sheet
            // with undefined, which becomes `null` here and the core treats
            // as a decline rather than falling back to the first credential.
            selectCredential: async (
                choices: PasskeyChoice[],
            ): Promise<string | null> => {
                const chosen = await requestBottomSheet<string>({
                    contents: (
                        <PasskeyChooserContent
                            rpId={current.rpId}
                            choices={choices}
                        />
                    ),
                    options: {
                        size: 'auto',
                        enablePanDownToClose: false,
                        enableCloseOnBackdropPress: false,
                    },
                })
                return chosen ?? null
            },
        }
        try {
            // Both halves of the same keystore: the engine mints and signs,
            // the reactive store is where the freshly derived public key and
            // the credential list are read back from.
            const signer = createKeystoreSigner(
                getKeystore() as unknown as PasskeyKeyStore,
                getKeystoreStore(),
            )
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
    }, [requestId, approval, requireVaultPassword, requestBottomSheet, t])

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
