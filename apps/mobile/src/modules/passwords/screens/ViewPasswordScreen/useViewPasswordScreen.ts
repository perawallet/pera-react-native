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

import { useCallback, useMemo, useState } from 'react'
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    readLogin,
    useDeleteLoginMutation,
    useLoginsQuery,
    type Login,
} from '@perawallet/wallet-core-passwords'
import { useClipboard } from '@hooks/useClipboard'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

export type UseViewPasswordScreenResult = {
    login: Login | null
    password: string | null
    isRevealed: boolean
    isLoading: boolean
    isNotFound: boolean
    handleToggleReveal: () => Promise<void>
    handleCopy: () => Promise<void>
    handleEdit: () => void
    handleDelete: () => Promise<void>
}

export const useViewPasswordScreen = (
    id: string,
): UseViewPasswordScreenResult => {
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { logins, isLoading } = useLoginsQuery()
    const { deleteLogin } = useDeleteLoginMutation()
    const { copyToClipboard } = useClipboard()
    const { errorToast } = useToast()
    const { t } = useLanguage()

    const [password, setPassword] = useState<string | null>(null)

    const login = useMemo(
        () => logins.find(candidate => candidate.id === id) ?? null,
        [logins, id],
    )

    const showReadError = useCallback(() => {
        errorToast(t('common.error.title'), t('common.error.body'))
    }, [errorToast, t])

    // The list query carries no password — it is projected out at the store
    // boundary — so plaintext only ever enters this hook when the user asks
    // for it, and hiding drops the reference rather than keeping it offscreen.
    const handleToggleReveal = useCallback(async () => {
        if (password !== null) {
            setPassword(null)
            return
        }
        try {
            const secret = await readLogin(id)
            setPassword(secret?.password ?? null)
        } catch {
            showReadError()
        }
    }, [password, id, showReadError])

    const handleCopy = useCallback(async () => {
        try {
            const secret = await readLogin(id)
            if (!secret) return
            await copyToClipboard(secret.password)
        } catch {
            showReadError()
        }
    }, [id, copyToClipboard, showReadError])

    const handleEdit = useCallback(() => {
        navigation.navigate('EditPassword', { id })
    }, [navigation, id])

    const handleDelete = useCallback(async () => {
        await deleteLogin(id)
        navigation.goBack()
    }, [deleteLogin, id, navigation])

    return {
        login,
        password,
        isRevealed: password !== null,
        isLoading,
        isNotFound: !isLoading && login === null,
        handleToggleReveal,
        handleCopy,
        handleEdit,
        handleDelete,
    }
}
