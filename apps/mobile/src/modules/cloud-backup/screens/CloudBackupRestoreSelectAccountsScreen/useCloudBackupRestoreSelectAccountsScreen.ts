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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    useCloudBackupRestoreDraftStore,
    useCloudBackupRestoreSessionStore,
    useCompleteCloudBackupRestoreMutation,
    useDiscardCloudBackupRestore,
    type BackupAccountOption,
} from '@perawallet/wallet-core-backup'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'
import { useNavigationLock } from '@hooks/useNavigationLock'
import {
    useCloudBackupRestoreProgress,
    type UseCloudBackupRestoreProgressResult,
} from '../../hooks/useCloudBackupRestoreProgress'
import { useRestoreOutcome } from '../../hooks/useRestoreOutcome'

export type RestoreAccountsMode = 'all' | 'selected'

export type RestoreAccountRow = {
    group: string
    title: string
    /** The address, under a name that isn't it already. */
    subtitle?: string
    /** Empty for an account on one chain, which needs no chain icons. */
    chainIds: ChainId[]
    isSelected: boolean
}

export type UseCloudBackupRestoreSelectAccountsScreenParams = {
    /** Where the flow lands once the restore is in. The screen is registered
     *  in the cloud-backup stack and the import flow, which share no route. */
    onDone: () => void
}

type UseCloudBackupRestoreSelectAccountsScreenResult = {
    accountCount: number
    /** Accounts already on this device, which joining uploads to the backup. */
    deviceAccountCount: number
    mode: RestoreAccountsMode
    rows: RestoreAccountRow[]
    canRestore: boolean
    isRestoring: boolean
    restoreProgress: UseCloudBackupRestoreProgressResult
    handleSelectMode: (mode: RestoreAccountsMode) => void
    handleToggleAccount: (group: string) => void
    handleRestore: () => void
}

const NO_ACCOUNTS: BackupAccountOption[] = []

const toRow = (
    { group, name, chains }: BackupAccountOption,
    selected: ReadonlySet<string>,
): RestoreAccountRow => {
    const address = truncateAlgorandAddress(chains[0]?.address ?? group)
    return {
        group,
        title: name ?? address,
        ...(name && name !== address ? { subtitle: address } : {}),
        chainIds:
            chains.length > 1
                ? chains.flatMap(({ chain }) => (chain ? [chain] : []))
                : [],
        isSelected: selected.has(group),
    }
}

/** Leaving before the restore lands ends it, so the device is not left
 *  holding the backup's keys. */
const useDiscardOnLeave = (): void => {
    const { discard } = useDiscardCloudBackupRestore()
    useEffect(() => () => void discard(), [discard])
}

export const useCloudBackupRestoreSelectAccountsScreen = ({
    onDone,
}: UseCloudBackupRestoreSelectAccountsScreenParams): UseCloudBackupRestoreSelectAccountsScreenResult => {
    const navigation = useNavigation()
    const accounts = useCloudBackupRestoreSessionStore(
        state => state.session?.prepared.accounts ?? NO_ACCOUNTS,
    )
    const deviceAccountCount = useAccountsStore(state => state.accounts.length)
    const clearDraft = useCloudBackupRestoreDraftStore(
        state => state.clearDraft,
    )
    const [mode, setMode] = useState<RestoreAccountsMode>('all')
    const [selected, setSelected] = useState<ReadonlySet<string>>(
        () => new Set(),
    )
    useDiscardOnLeave()

    // Set on the press, not from the mutation, so no render passes unlocked.
    // The overlay is no modal: back and swipe still work under it, and the
    // restore owns the exit until it lands or fails.
    const [isLocked, setIsLocked] = useState(false)
    // The lock renders a frame late; a second tap in that frame would start a
    // second restore against the session the first one already took.
    const isStartedRef = useRef(false)
    const { allowProgrammaticNavigation } = useNavigationLock(isLocked)
    const exit = useCallback(() => {
        allowProgrammaticNavigation()
        onDone()
    }, [allowProgrammaticNavigation, onDone])
    const { onSuccess, onError: showFailure } = useRestoreOutcome({
        clearDraft,
        onDone: exit,
    })
    // A failed restore removed the stored keys, so the user starts over.
    const onError = useCallback(
        (error: unknown) => {
            showFailure(error)
            allowProgrammaticNavigation()
            isStartedRef.current = false
            setIsLocked(false)
            navigation.goBack()
        },
        [showFailure, allowProgrammaticNavigation, navigation],
    )
    const scope = useSelectedScope(ALGORAND_CHAIN_ID)
    const { mutate: complete, isPending: isRestoring } =
        useCompleteCloudBackupRestoreMutation(scope, { onSuccess, onError })
    const restoreProgress = useCloudBackupRestoreProgress()

    const rows = useMemo(
        () => accounts.map(account => toRow(account, selected)),
        [accounts, selected],
    )

    const handleToggleAccount = useCallback((group: string) => {
        setSelected(current => {
            const next = new Set(current)
            if (!next.delete(group)) next.add(group)
            return next
        })
    }, [])

    const handleRestore = useCallback(() => {
        if (isStartedRef.current) return
        isStartedRef.current = true
        setIsLocked(true)
        complete(mode === 'all' ? 'all' : selected)
    }, [complete, mode, selected])

    return {
        accountCount: accounts.length,
        deviceAccountCount,
        mode,
        rows,
        canRestore: !isRestoring && (mode === 'all' || selected.size > 0),
        isRestoring,
        restoreProgress,
        handleSelectMode: setMode,
        handleToggleAccount,
        handleRestore,
    }
}
