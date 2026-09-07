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
import { contactSchema, type Contact } from '@perawallet/wallet-core-contacts'

import { useImagePicker } from '@hooks/useImagePicker'
import { useNfdResolve } from '@hooks/useNfdResolve'

import type { Optional } from '@perawallet/wallet-core-shared'

export type NfdState = {
    resolvedAddress: string
    isNfdResolved: boolean
    isNfdResolving: boolean
    nfdName: Optional<string>
}

export type UseContactFormResult = {
    control: Control<Contact>
    handleSubmit: UseFormHandleSubmit<Contact>
    setError: UseFormSetError<Contact>
    errors: FieldErrors<Contact>
    isValid: boolean
    rawAddressInput: string
    imageUri: Optional<string>
    nfd: NfdState
    onAddressInputChange: (text: string) => void
    onPickImage: () => Promise<void>
}

/**
 * Shared form plumbing for Add and Edit Contact screens. Owns the
 * react-hook-form instance, the raw address-input state, NFD resolution, and
 * the image picker wiring. Each screen supplies its own submit / delete
 * behaviour on top of what this returns.
 */
export const useContactForm = (
    initialContact: Contact | null,
): UseContactFormResult => {
    const { pickFromGallery } = useImagePicker()

    const {
        control,
        handleSubmit,
        setError,
        setValue,
        watch,
        formState: { isValid, errors },
    } = useForm<Contact>({
        resolver: zodResolver(contactSchema),
        mode: 'onChange',
        defaultValues: initialContact ?? { name: '', address: '' },
    })

    const addressFieldValue = watch('address')
    const imageUri = watch('image')
    const [rawAddressInput, setRawAddressInput] = useState(
        addressFieldValue ?? '',
    )

    const { resolvedAddress, isNfdResolved, isNfdResolving, nfdName } =
        useNfdResolve(rawAddressInput)

    useEffect(() => {
        if (isNfdResolved) {
            setRawAddressInput(resolvedAddress)
            setValue('address', resolvedAddress, { shouldValidate: true })
        }
    }, [isNfdResolved, resolvedAddress, setValue])

    const onAddressInputChange = useCallback(
        (text: string) => {
            const sanitized = text.replace(/\s/g, '')
            setRawAddressInput(sanitized)
            setValue('address', sanitized, { shouldValidate: true })
        },
        [setValue],
    )

    const onPickImage = useCallback(async () => {
        const uri = await pickFromGallery()
        if (uri) {
            setValue('image', uri, { shouldValidate: true, shouldDirty: true })
        }
    }, [pickFromGallery, setValue])

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
            rawAddressInput,
            imageUri,
            nfd,
            onAddressInputChange,
            onPickImage,
        }),
        [
            control,
            handleSubmit,
            setError,
            errors,
            isValid,
            rawAddressInput,
            imageUri,
            nfd,
            onAddressInputChange,
            onPickImage,
        ],
    )
}
