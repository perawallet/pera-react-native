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

import { useCallback, useEffect, useState } from 'react'
import { usePasskeyAutofillService } from '@perawallet/wallet-core-passkeys'
import { useLoginsQuery, type Login } from '@perawallet/wallet-core-passwords'
import { logger } from '@perawallet/wallet-core-shared'

export type AutofillPickerCaller = {
    packageName: string
    label: string | null
    host: string | null
}

export type UseAutofillPickerScreenResult = {
    callerText: string
    hostText: string | null
    isUnlocked: boolean
    isUnlocking: boolean
    logins: Login[]
    handleUnlock: () => void
    handleSelect: (id: string) => void
    handleCancel: () => void
}

const MAX_LABEL_LENGTH = 40
const MAX_HOST_LENGTH = 60

// Both halves of the caller line are attacker-chosen: the label comes from the
// requesting app's own manifest, and webDomain on an unlinked request is set by
// that app too and only trimmed on the way here, never validated. Either can
// impersonate another app, hide what follows behind newlines, or reverse it
// with a bidi override. The package name is assigned by the platform, so it
// leads and everything else is sanitised decoration.
const sanitizeCallerText = (
    value: string | null,
    maxLength: number,
): string | null => {
    if (value === null) {
        return null
    }
    const flattened = value.replace(/[\p{Cc}\p{Cf}]/gu, ' ').trim()
    if (flattened === '') {
        return null
    }
    return flattened.length > maxLength
        ? `${flattened.slice(0, maxLength)}…`
        : flattened
}

export const useAutofillPickerScreen = (
    caller: AutofillPickerCaller,
): UseAutofillPickerScreenResult => {
    const service = usePasskeyAutofillService()
    const [isUnlocked, setIsUnlocked] = useState(false)
    const [isUnlocking, setIsUnlocking] = useState(false)

    useEffect(() => {
        void service.autofillPickerReady()
    }, [service])

    // Gating the query, not just the render: listLogins unseals every stored
    // password to build its summaries, so leaving it enabled would decrypt the
    // whole vault into the JS heap the moment any app triggers a fill.
    const { logins } = useLoginsQuery({ enabled: isUnlocked })

    const handleUnlock = useCallback(() => {
        setIsUnlocking(true)
        void service
            .requestAutofillUnlock()
            .then(granted => setIsUnlocked(granted))
            .catch(err => {
                // Fails closed either way, but a rejection here is the
                // biometric prompt itself failing — worth a trace, not a
                // silent swallow.
                logger.warn('requestAutofillUnlock failed', { error: err })
            })
            .finally(() => setIsUnlocking(false))
    }, [service])

    const handleSelect = useCallback(
        (id: string) => {
            void service.resolveAutofillPick(id)
        },
        [service],
    )

    const handleCancel = useCallback(() => {
        void service.cancelAutofillPick()
    }, [service])

    const label = sanitizeCallerText(caller.label, MAX_LABEL_LENGTH)

    return {
        callerText: label
            ? `${caller.packageName} · ${label}`
            : caller.packageName,
        hostText: sanitizeCallerText(caller.host, MAX_HOST_LENGTH),
        isUnlocked,
        isUnlocking,
        // Backstop for a warm cache: enabled:false stops a fetch but still
        // hands back anything already cached under this key.
        logins: isUnlocked ? logins : [],
        handleUnlock,
        handleSelect,
        handleCancel,
    }
}
