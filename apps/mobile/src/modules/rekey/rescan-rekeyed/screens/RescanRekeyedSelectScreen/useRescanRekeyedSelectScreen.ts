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

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRoute } from '@react-navigation/native'
import { useRescanRekeyedAccounts } from '@perawallet/wallet-core-accounts'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useErrorToast } from '@hooks/useErrorToast'

import type { RouteProp } from '@react-navigation/native'
import type { RescanRekeyedStackParamList } from '../../routes/types'

export type UseRescanRekeyedSelectScreenResult = {
    sourceAddress: string
    isLoading: boolean
    isError: boolean
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
        const sourceAddress = route.params.sourceAddress

        const { scan, importSelected } = useRescanRekeyedAccounts()
        const { showError } = useErrorToast()

        const [isLoading, setIsLoading] = useState(true)
        const [isError, setIsError] = useState(false)
        const [importedAddresses, setImportedAddresses] = useState<string[]>([])
        const [candidateAddresses, setCandidateAddresses] = useState<string[]>(
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
            try {
                const result = await scan(sourceAddress)
                if (scanIdRef.current !== scanId) return
                setImportedAddresses(result.importedAddresses)
                setCandidateAddresses(result.notImportedAddresses)
                // Default-select every candidate so tapping "Add accounts"
                // works with a single tap when the list is short.
                setSelectedAddresses(new Set(result.notImportedAddresses))
            } catch {
                if (scanIdRef.current !== scanId) return
                setIsError(true)
            } finally {
                if (scanIdRef.current === scanId) {
                    setIsLoading(false)
                }
            }
        }, [scan, sourceAddress])

        useEffect(() => {
            void runScan()
        }, [runScan])

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
                await importSelected(
                    sourceAddress,
                    Array.from(selectedAddresses),
                )
                navigation.navigate('TabBar', { screen: 'Home' })
            } catch (error) {
                showError(error)
            } finally {
                setIsSubmitting(false)
            }
        }, [
            importSelected,
            navigation,
            selectedAddresses,
            showError,
            sourceAddress,
        ])

        const handleSkip = useCallback(() => {
            navigation.goBack()
        }, [navigation])

        const handleRetry = useCallback(() => {
            void runScan()
        }, [runScan])

        return {
            sourceAddress,
            isLoading,
            isError,
            importedAddresses,
            candidateAddresses,
            selectedAddresses,
            isAllSelected,
            isSubmitting,
            canSubmit: selectedAddresses.size > 0,
            toggleAddress,
            toggleSelectAll,
            handleAddSelected,
            handleSkip,
            handleRetry,
        }
    }
