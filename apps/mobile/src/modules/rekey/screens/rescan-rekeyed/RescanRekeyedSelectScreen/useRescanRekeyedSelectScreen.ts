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
import { useRoute, type RouteProp } from '@react-navigation/native'
import {
    useRescanRekeyedAccounts,
    useSigningAccounts,
    type RekeyedSweepCandidate,
} from '@perawallet/wallet-core-accounts'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useErrorToast } from '@hooks/useErrorToast'
import { useToast } from '@hooks/useToast'
import { useLanguage } from '@hooks/useLanguage'

import type { RescanRekeyedStackParamList } from '../../../routes/rescan-rekeyed/types'

export type UseRescanRekeyedSelectScreenResult = {
    /** True when scanning every signable key rather than a single one. */
    isSweep: boolean
    isLoading: boolean
    isError: boolean
    scanProgress: { scanned: number; total: number } | null
    /** Keys whose indexer scan failed while others succeeded. */
    failedSourceCount: number
    importedAddresses: string[]
    candidateAddresses: string[]
    selectedAddresses: Set<string>
    isAllSelected: boolean
    isSubmitting: boolean
    canSubmit: boolean
    toggleAddress: (address: string) => void
    toggleSelectAll: () => void
    handleAddSelected: () => void
    handleSkip: () => void
    handleRetry: () => void
}

export const useRescanRekeyedSelectScreen =
    (): UseRescanRekeyedSelectScreenResult => {
        const navigation = useAppNavigation()
        const route =
            useRoute<
                RouteProp<RescanRekeyedStackParamList, 'RescanRekeyedSelect'>
            >()
        const sourceAddress = route.params?.sourceAddress

        const { scanAll, importFromSweep } = useRescanRekeyedAccounts()
        const signingAccounts = useSigningAccounts()
        const { showError } = useErrorToast()
        const { showToast } = useToast()
        const { t } = useLanguage()

        // Freeze the key set at entry. Importing sweep candidates writes the
        // accounts store, which would otherwise change the signable set and
        // re-trigger the scan effect mid-import.
        const [sources] = useState<string[]>(() =>
            sourceAddress
                ? [sourceAddress]
                : signingAccounts.map(account => account.address),
        )

        const [isLoading, setIsLoading] = useState(true)
        const [isError, setIsError] = useState(false)
        const [scanProgress, setScanProgress] = useState<{
            scanned: number
            total: number
        } | null>(null)
        const [failedSourceCount, setFailedSourceCount] = useState(0)
        const [importedAddresses, setImportedAddresses] = useState<string[]>([])
        const [candidates, setCandidates] = useState<RekeyedSweepCandidate[]>(
            [],
        )
        const [selectedAddresses, setSelectedAddresses] = useState<Set<string>>(
            new Set(),
        )
        const [isSubmitting, setIsSubmitting] = useState(false)

        // Track in-flight scan so a retry doesn't race a stale result.
        const scanIdRef = useRef(0)

        const runScan = useCallback(async () => {
            const scanId = ++scanIdRef.current
            setIsLoading(true)
            setIsError(false)
            setScanProgress({ scanned: 0, total: sources.length })
            try {
                const result = await scanAll(sources, {
                    onProgress: (scanned, total) => {
                        if (scanIdRef.current !== scanId) return
                        setScanProgress({ scanned, total })
                    },
                })
                if (scanIdRef.current !== scanId) return
                setImportedAddresses(result.importedAddresses)
                setCandidates(result.candidates)
                // Default-select every candidate so tapping "Add accounts"
                // works with a single tap when the list is short.
                setSelectedAddresses(
                    new Set(result.candidates.map(c => c.address)),
                )
                setFailedSourceCount(result.failedSources.length)
                // Every key failing is an error; a subset failing is a
                // partial sweep the screen annotates instead.
                setIsError(
                    sources.length > 0 &&
                        result.failedSources.length === sources.length,
                )
            } catch {
                if (scanIdRef.current !== scanId) return
                setIsError(true)
            } finally {
                if (scanIdRef.current === scanId) {
                    setIsLoading(false)
                }
            }
        }, [scanAll, sources])

        useEffect(() => {
            void runScan()
        }, [runScan])

        const candidateAddresses = useMemo(
            () => candidates.map(c => c.address),
            [candidates],
        )

        const toggleAddress = useCallback((address: string) => {
            setSelectedAddresses(prev => {
                const next = new Set(prev)
                if (next.has(address)) {
                    next.delete(address)
                } else {
                    next.add(address)
                }
                return next
            })
        }, [])

        const isAllSelected =
            candidateAddresses.length > 0 &&
            selectedAddresses.size === candidateAddresses.length

        const toggleSelectAll = useCallback(() => {
            setSelectedAddresses(prev =>
                prev.size === candidateAddresses.length
                    ? new Set()
                    : new Set(candidateAddresses),
            )
        }, [candidateAddresses])

        const handleAddSelected = useCallback(async () => {
            if (selectedAddresses.size === 0) return
            try {
                setIsSubmitting(true)
                const importedCount = await importFromSweep(
                    candidates.filter(candidate =>
                        selectedAddresses.has(candidate.address),
                    ),
                )
                if (importedCount > 0) {
                    navigation.navigate('TabBar', { screen: 'Home' })
                    return
                }
                // Nothing was persisted — every selected address was invalid
                // or already in the wallet. Surface it instead of silently
                // navigating home as if the import succeeded.
                showToast({
                    title: t('rekey.rescan.nothing_imported_title'),
                    body: t('rekey.rescan.nothing_imported_body'),
                    type: 'error',
                })
            } catch (error) {
                showError(error)
            } finally {
                setIsSubmitting(false)
            }
        }, [
            importFromSweep,
            navigation,
            candidates,
            selectedAddresses,
            showError,
            showToast,
            t,
        ])

        const handleSkip = useCallback(() => {
            navigation.goBack()
        }, [navigation])

        const handleRetry = useCallback(() => {
            void runScan()
        }, [runScan])

        return {
            isSweep: !sourceAddress,
            isLoading,
            isError,
            scanProgress,
            failedSourceCount,
            importedAddresses,
            candidateAddresses,
            selectedAddresses,
            isAllSelected,
            isSubmitting,
            canSubmit: selectedAddresses.size > 0,
            toggleAddress,
            toggleSelectAll,
            handleAddSelected: () => void handleAddSelected(),
            handleSkip,
            handleRetry,
        }
    }
