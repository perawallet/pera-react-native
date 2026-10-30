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
import {
    useForm,
    type Control,
    type FieldErrors,
    type UseFormHandleSubmit,
    type UseFormSetError,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
    CHAIN_FAMILIES,
    type ChainFamily,
} from '@perawallet/wallet-core-chain-contract'
import {
    addressFamilyOf,
    contactSchema,
    contactToFormValues,
    isSameFamilyAddress,
    useContacts,
    type AddressFamilyMatch,
    type ContactAddresses,
    type ContactFormValues,
    type NewContact,
} from '@perawallet/wallet-core-contacts'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'

import { useImagePicker } from '@hooks/useImagePicker'
import { useCapableChainId } from '@hooks/useCapableChainIds'
import { useNfdResolve } from '@hooks/useNfdResolve'

import type { Optional, Nullable } from '@perawallet/wallet-core-shared'

export type NfdState = {
    resolvedAddress: string
    isNfdResolved: boolean
    isNfdResolving: boolean
    nfdName: Optional<string>
}

export type ContactAddressRow = {
    family: ChainFamily
    address: string
    /** Another contact holds the address. Saving is still allowed: one person
     *  kept as two contacts is the user's call. */
    isDuplicate: boolean
}

export type UseContactFormResult = {
    control: Control<ContactFormValues>
    handleSubmit: UseFormHandleSubmit<ContactFormValues>
    setError: UseFormSetError<ContactFormValues>
    errors: FieldErrors<ContactFormValues>
    isValid: boolean
    addresses: ContactAddresses
    /** One per family the contact holds an address on, in family order. */
    addressRows: ContactAddressRow[]
    isAddressInputVisible: boolean
    rawAddressInput: string
    /** Typed or pasted text that no registered family's codec accepts. */
    isAddressInputInvalid: boolean
    /** An entered address for a family that already holds another, waiting
     *  for the user to confirm the replacement. */
    pendingReplacement: Optional<AddressFamilyMatch>
    imageUri: Optional<string>
    nfd: NfdState
    showAddressInput: () => void
    onAddressInputChange: (text: string) => void
    confirmReplacement: () => void
    cancelReplacement: () => void
    removeAddress: (family: ChainFamily) => void
    onPickImage: () => Promise<void>
}

/**
 * Shared form plumbing for Add and Edit Contact screens. Owns the
 * react-hook-form instance, the address being entered and the family it
 * belongs to, NFD resolution, and the image picker wiring. Each screen
 * supplies its own submit / delete behaviour on top of what this returns.
 */
export const useContactForm = (
    initialContact: Nullable<NewContact>,
): UseContactFormResult => {
    const { pickFromGallery } = useImagePicker()
    const { contacts } = useContacts()

    const {
        control,
        handleSubmit,
        setError,
        setValue,
        watch,
        formState: { isValid, errors },
    } = useForm<ContactFormValues>({
        resolver: zodResolver(contactSchema),
        mode: 'onChange',
        defaultValues: initialContact
            ? contactToFormValues(initialContact)
            : { name: '', addresses: {} },
    })

    const watchedAddresses = watch('addresses')
    const addresses = useMemo(() => watchedAddresses ?? {}, [watchedAddresses])
    const imageUri = watch('image')
    const hasAnyAddress = Object.values(addresses).some(Boolean)
    const [isInputRequested, setIsInputRequested] = useState(false)
    const isAddressInputVisible = isInputRequested || !hasAnyAddress
    const [rawAddressInput, setRawAddressInput] = useState('')
    const [pendingReplacement, setPendingReplacement] =
        useState<Optional<AddressFamilyMatch>>()

    const nameChainId = useCapableChainId('nameService')
    const nameChainScope = useSelectedScope(nameChainId)
    const { resolvedAddress, isNfdResolved, isNfdResolving, nfdName } =
        useNfdResolve(rawAddressInput, nameChainScope)

    const setAddresses = useCallback(
        (next: ContactAddresses) =>
            setValue('addresses', next, {
                shouldValidate: true,
                shouldDirty: true,
            }),
        [setValue],
    )

    const closeInput = useCallback(() => {
        setRawAddressInput('')
        setIsInputRequested(false)
    }, [])

    const commitAddress = useCallback(
        (match: AddressFamilyMatch) => {
            const held = addresses[match.family]
            if (
                held &&
                !isSameFamilyAddress(match.family, held, match.address)
            ) {
                setPendingReplacement(match)
                return
            }
            setAddresses({ ...addresses, [match.family]: match.address })
            closeInput()
        },
        [addresses, setAddresses, closeInput],
    )

    const onAddressInputChange = useCallback(
        (text: string) => {
            const sanitized = text.replace(/\s/g, '')
            setRawAddressInput(sanitized)
            const match = addressFamilyOf(sanitized)
            if (match) commitAddress(match)
        },
        [commitAddress],
    )

    useEffect(() => {
        if (!isNfdResolved) return
        const match = addressFamilyOf(resolvedAddress)
        if (match) commitAddress(match)
    }, [isNfdResolved, resolvedAddress, commitAddress])

    const confirmReplacement = useCallback(() => {
        if (!pendingReplacement) return
        setAddresses({
            ...addresses,
            [pendingReplacement.family]: pendingReplacement.address,
        })
        setPendingReplacement(undefined)
        closeInput()
    }, [pendingReplacement, addresses, setAddresses, closeInput])

    const cancelReplacement = useCallback(() => {
        setPendingReplacement(undefined)
        closeInput()
    }, [closeInput])

    const removeAddress = useCallback(
        (family: ChainFamily) => {
            const { [family]: _, ...rest } = addresses
            setAddresses(rest)
        },
        [addresses, setAddresses],
    )

    const showAddressInput = useCallback(() => setIsInputRequested(true), [])

    const onPickImage = useCallback(async () => {
        const uri = await pickFromGallery()
        if (uri) {
            setValue('image', uri, { shouldValidate: true, shouldDirty: true })
        }
    }, [pickFromGallery, setValue])

    const addressRows = useMemo(
        (): ContactAddressRow[] =>
            CHAIN_FAMILIES.flatMap(family => {
                const address = addresses[family]
                if (!address) return []
                const isDuplicate = contacts.some(contact => {
                    const other = contact.addresses[family]
                    return (
                        contact.id !== initialContact?.id &&
                        !!other &&
                        isSameFamilyAddress(family, other, address)
                    )
                })
                return [{ family, address, isDuplicate }]
            }),
        [addresses, contacts, initialContact?.id],
    )

    const isAddressInputInvalid =
        rawAddressInput.length > 0 &&
        !isNfdResolving &&
        !isNfdResolved &&
        addressFamilyOf(rawAddressInput) === undefined

    const nfd = useMemo<NfdState>(
        () => ({ resolvedAddress, isNfdResolved, isNfdResolving, nfdName }),
        [resolvedAddress, isNfdResolved, isNfdResolving, nfdName],
    )

    return useMemo(
        () => ({
            control,
            handleSubmit,
            setError,
            errors,
            isValid,
            addresses,
            addressRows,
            isAddressInputVisible,
            rawAddressInput,
            isAddressInputInvalid,
            pendingReplacement,
            imageUri,
            nfd,
            showAddressInput,
            onAddressInputChange,
            confirmReplacement,
            cancelReplacement,
            removeAddress,
            onPickImage,
        }),
        [
            control,
            handleSubmit,
            setError,
            errors,
            isValid,
            addresses,
            addressRows,
            isAddressInputVisible,
            rawAddressInput,
            isAddressInputInvalid,
            pendingReplacement,
            imageUri,
            nfd,
            showAddressInput,
            onAddressInputChange,
            confirmReplacement,
            cancelReplacement,
            removeAddress,
            onPickImage,
        ],
    )
}
