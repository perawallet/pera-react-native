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

import { PWDropdown, PWIcon, PWView } from '@components/core'
import { useAccountHeaderMenu } from './useAccountHeaderMenu'

export type AccountHeaderMenuProps = {
    testID?: string
}

export const AccountHeaderMenu = ({
    testID = 'account_header_menu',
}: AccountHeaderMenuProps) => {
    const { items } = useAccountHeaderMenu()

    return (
        <PWView testID={testID}>
            <PWDropdown items={items}>
                <PWIcon name='ellipsis' />
            </PWDropdown>
        </PWView>
    )
}
