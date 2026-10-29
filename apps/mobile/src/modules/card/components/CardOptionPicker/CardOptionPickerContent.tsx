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

import type {
    RegistrationOption,
    RegistrationOptionList,
} from '@perawallet/wallet-core-card'
import { SettingsOptionPicker } from './SettingsOptionPicker'
import { FixedOptionPicker } from './FixedOptionPicker'

export type CardOptionPickerContentProps = {
    title: string
} & (
    | { list: RegistrationOptionList; options?: undefined }
    /** A short fixed set the app owns, shown without search. */
    | { options: RegistrationOption[]; list?: undefined }
)

export const CardOptionPickerContent = (props: CardOptionPickerContentProps) =>
    props.list === undefined ? (
        <FixedOptionPicker
            title={props.title}
            options={props.options}
        />
    ) : (
        <SettingsOptionPicker
            title={props.title}
            list={props.list}
        />
    )
