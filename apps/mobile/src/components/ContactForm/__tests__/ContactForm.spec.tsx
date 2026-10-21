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

type FormValues = { name: string }

type HarnessProps = Omit<
    React.ComponentProps<typeof ContactForm<FormValues>>,
    'control'
>

const Harness = (props: HarnessProps) => {
    const { control } = useForm<FormValues>({ defaultValues: { name: '' } })
    return (
        <ContactForm<FormValues>
            control={control}
            {...props}
        />
    )
}

const baseProps = {
    address: 'PARTICIPANT',
    nameLabel: 'Name',
    addressLabel: 'Algorand address',
}

// PWInput is mocked as a bare <input>; labels show up as HTML attributes
// rather than rendered text. Assert on attributes/order.
const getInputs = () => [
    screen.getByTestId('contact_name_input'),
    screen.getByTestId('contact_address_input'),
]

describe('ContactForm', () => {
    it('renders the name input first and a read-only address second', () => {
        render(<Harness {...baseProps} />)
        const inputs = getInputs()
        expect(inputs[0].getAttribute('label')).toBe('Name')
        expect(inputs[1].getAttribute('label')).toBe('Algorand address')
        expect(inputs[1].getAttribute('value')).toBe('PARTICIPANT')
    })

    it('renders the address section in place of the read-only address', () => {
        render(
            <Harness
                {...baseProps}
                addressSection={<input data-testid='address_section' />}
            />,
        )
        expect(screen.getByTestId('address_section')).toBeTruthy()
        expect(screen.queryByTestId('contact_address_input')).toBeNull()
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
        // The avatar's badge icon sits inside the touchable.
        fireEvent.click(screen.getByTestId('icon-plus'))
        expect(onPickImage).toHaveBeenCalledTimes(1)
    })
})
