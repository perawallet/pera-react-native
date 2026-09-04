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
    isLoading: boolean
    handleUnlock: () => void
    handleSelect: (id: string) => void
    handleCancel: () => void
}

const MAX_LABEL_LENGTH = 40

// An app's label is whatever its own manifest says, so it can impersonate
// another app, hide the package behind newlines, or reverse what follows with
// a bidi override. The package name is assigned by the platform, so it leads
// and the label is sanitised decoration.
const sanitizeLabel = (label: string | null): string | null => {
    if (label === null) {
        return null
    }
    const flattened = label.replace(/[\p{Cc}\p{Cf}]/gu, ' ').trim()
    if (flattened === '') {
        return null
    }
    return flattened.length > MAX_LABEL_LENGTH
        ? `${flattened.slice(0, MAX_LABEL_LENGTH)}…`
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

    const { logins, isLoading } = useLoginsQuery()

    const handleUnlock = useCallback(() => {
        setIsUnlocking(true)
        void service
            .requestAutofillUnlock()
            .then(granted => setIsUnlocked(granted))
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

    const label = sanitizeLabel(caller.label)

    return {
        callerText: label
            ? `${caller.packageName} · ${label}`
            : caller.packageName,
        hostText: caller.host,
        isUnlocked,
        isUnlocking,
        // The gate is what the user sees, not what the query fetched. Enforced
        // here rather than natively because the same bundle can already read
        // summaries on the Passwords screen without a prompt.
        logins: isUnlocked ? logins : [],
        isLoading,
        handleUnlock,
        handleSelect,
        handleCancel,
    }
}
