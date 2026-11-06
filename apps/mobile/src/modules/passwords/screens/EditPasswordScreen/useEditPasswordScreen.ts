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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import {
    readLogin,
    useSaveLoginMutation,
} from '@perawallet/wallet-core-passwords'
import { useLanguage } from '@hooks/useLanguage'

export type UseEditPasswordScreenResult = {
    domain: string
    username: string
    password: string
    note: string
    setDomain: (value: string) => void
    setUsername: (value: string) => void
    setPassword: (value: string) => void
    setNote: (value: string) => void
    canSave: boolean
    isLoading: boolean
    isSaving: boolean
    error: string | null
    handleSave: () => Promise<void>
}

export const useEditPasswordScreen = (
    id: string,
): UseEditPasswordScreenResult => {
    const navigation = useNavigation()
    const { t } = useLanguage()
    const { saveLogin, isPending, error } = useSaveLoginMutation()

    const [domain, setDomain] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [note, setNote] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [readError, setReadError] = useState<string | null>(null)
    const [isMissing, setIsMissing] = useState(false)

    // Read the sealed record through a plain effect rather than useQuery: the
    // query cache is disk-persisted (apps/mobile/src/providers/query-persistence.ts),
    // and the decrypted password must never reach it.
    useEffect(() => {
        let cancelled = false
        setIsLoading(true)
        setReadError(null)
        setIsMissing(false)
        void readLogin(id)
            .then(login => {
                if (cancelled) return
                if (!login) {
                    setIsMissing(true)
                    return
                }
                setDomain(login.domain)
                setUsername(login.username)
                setPassword(login.password)
                setNote(login.note ?? '')
            })
            .catch((err: unknown) => {
                if (cancelled) return
                setReadError(err instanceof Error ? err.message : String(err))
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [id])

    // A failed or empty read leaves the form blank; saving then would write a
    // record under an id that no longer exists.
    const canSave = useMemo(
        () =>
            !isLoading &&
            readError === null &&
            !isMissing &&
            domain.trim() !== '' &&
            password !== '',
        [isLoading, readError, isMissing, domain, password],
    )

    const handleSave = useCallback(async () => {
        if (!canSave) return
        try {
            await saveLogin({
                id,
                domain: domain.trim(),
                username: username.trim(),
                password,
                note: note.trim() === '' ? null : note.trim(),
            })
        } catch {
            // The mutation's `error` is what the screen renders; rethrowing out
            // of a `void handleSave()` would only add an unhandled rejection.
            return
        }
        navigation.goBack()
    }, [canSave, id, domain, username, password, note, saveLogin, navigation])

    return {
        domain,
        username,
        password,
        note,
        setDomain,
        setUsername,
        setPassword,
        setNote,
        canSave,
        isLoading,
        isSaving: isPending,
        error:
            error?.message ??
            readError ??
            (isMissing ? t('settings.passwords.not_found_body') : null),
        handleSave,
    }
}
