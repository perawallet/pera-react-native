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

import { describe, it, expect, vi } from 'vitest'
import { useForm } from 'react-hook-form'
import { fireEvent, render, screen } from '@test-utils/render'
import { ContactForm } from '../ContactForm'

// QRScannerView is now always mounted (isVisible toggles it, it's never
// conditionally rendered) — vitest resolves the bare specifier to the
// native module, whose hooks reach into providers (network, etc.) this
// lightweight render tree doesn't set up. This spec only cares about
// ContactForm's own input behavior, not scanner internals.
vi.mock('@components/QRScannerView', () => ({
    QRScannerView: () => null,
    scannerNotifier: { current: null },
}))

type FormValues = { name: string; address: string }

type HarnessProps = Omit<
    React.ComponentProps<typeof ContactForm<FormValues>>,
    'control'
> & {
    defaultValues?: Partial<FormValues>
}

const Harness = ({ defaultValues, ...props }: HarnessProps) => {
    const { control } = useForm<FormValues>({
        defaultValues: {
            name: defaultValues?.name ?? '',
            address: defaultValues?.address ?? '',
        },
    })
    return (
        <ContactForm<FormValues>
            control={control}
            {...props}
        />
    )
}

const baseProps = {
    address: '',
    nameLabel: 'Name',
    addressLabel: 'Algorand address',
}

// PWInput is mocked as a bare <input>; labels + errorMessage show up as
// HTML attributes rather than rendered text. Assert on attributes/order.
const getInputs = () => [
    screen.getByTestId('contact_name_input'),
    screen.getByTestId('contact_address_input'),
]

describe('ContactForm', () => {
    it('renders the name input first and the address input second', () => {
        render(<Harness {...baseProps} />)
        const inputs = getInputs()
        expect(inputs).toHaveLength(2)
        expect(inputs[0].getAttribute('label')).toBe('Name')
        expect(inputs[1].getAttribute('label')).toBe('Algorand address')
    })

    it('omits the QR scan icon when no change handler is passed (read-only address)', () => {
        render(<Harness {...baseProps} />)
        const addressInput = getInputs()[1]
        expect(addressInput.getAttribute('righticon')).toBeNull()
    })

    it('renders the QR scan icon when a change handler is passed (editable address)', () => {
        render(
            <Harness
                {...baseProps}
                onAddressInputChange={vi.fn()}
            />,
        )
        const addressInput = getInputs()[1]
        expect(addressInput.getAttribute('righticon')).not.toBeNull()
    })

    it('shows the "add photo" label when onPickImage is provided and no imageUri', () => {
        render(
            <Harness
                {...baseProps}
                onPickImage={vi.fn()}
            />,
        )
        expect(screen.getByText('contacts.edit_contact.add_photo')).toBeTruthy()
    })

    it('hides the "add photo" label when an imageUri is present', () => {
        render(
            <Harness
                {...baseProps}
                onPickImage={vi.fn()}
                imageUri='file://photo.jpg'
            />,
        )
        expect(screen.queryByText('contacts.edit_contact.add_photo')).toBeNull()
    })

    it('invokes onPickImage when the avatar touchable is pressed', () => {
        const onPickImage = vi.fn()
        render(
            <Harness
                {...baseProps}
                onPickImage={onPickImage}
            />,
        )
        fireEvent.click(screen.getByTestId('PWTouchableOpacity'))
        expect(onPickImage).toHaveBeenCalledTimes(1)
    })

    it('shows the NFD resolving indicator when isResolvingNfd is true', () => {
        render(
            <Harness
                {...baseProps}
                isResolvingNfd
            />,
        )
        expect(screen.getByText('address_entry.nfd_resolving')).toBeTruthy()
    })

    it('renders the resolved NFD row when nfdName is provided', () => {
        render(
            <Harness
                {...baseProps}
                address='ABCDEF'
                nfdName='alice.algo'
            />,
        )
        // i18n returns the raw key in tests — confirm the NFD branch mounted.
        expect(screen.getByText(/address_entry\.nfd_resolved/)).toBeTruthy()
    })

    it('surfaces address errors as an attribute on the address input', () => {
        render(
            <Harness
                {...baseProps}
                addressError='Invalid address'
            />,
        )
        const addressInput = getInputs()[1]
        expect(addressInput.getAttribute('errormessage')).toBe(
            'Invalid address',
        )
    })

    it('forwards address input changes to onAddressInputChange', () => {
        const onAddressInputChange = vi.fn()
        render(
            <Harness
                {...baseProps}
                onAddressInputChange={onAddressInputChange}
            />,
        )
        const addressInput = getInputs()[1]
        fireEvent.change(addressInput, {
            target: { value: 'PASTED_ADDRESS' },
        })
        expect(onAddressInputChange).toHaveBeenCalledWith('PASTED_ADDRESS')
    })
})
