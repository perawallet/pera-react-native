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
    const { saveLogin, isPending, error } = useSaveLoginMutation()

    const [domain, setDomain] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [note, setNote] = useState('')
    const [isLoading, setIsLoading] = useState(true)

    // Read the sealed record through a plain effect rather than useQuery: the
    // query cache is disk-persisted (apps/mobile/src/providers/query-persistence.ts),
    // and the decrypted password must never reach it. The form is uncontrolled
    // until this resolves, which is what lets the fields populate on the
    // render after the unseal completes.
    useEffect(() => {
        let cancelled = false
        setIsLoading(true)
        void readLogin(id)
            .then(login => {
                if (cancelled || !login) return
                setDomain(login.domain)
                setUsername(login.username)
                setPassword(login.password)
                setNote(login.note ?? '')
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [id])

    const canSave = useMemo(
        () => domain.trim() !== '' && password !== '',
        [domain, password],
    )

    const handleSave = useCallback(async () => {
        if (!canSave) return
        await saveLogin({
            id,
            domain: domain.trim(),
            username: username.trim(),
            password,
            note: note.trim() === '' ? null : note.trim(),
        })
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
        error: error?.message ?? null,
        handleSave,
    }
}
