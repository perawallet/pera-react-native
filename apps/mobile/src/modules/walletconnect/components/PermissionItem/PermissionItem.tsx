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

import { PWIcon, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import {
    CONNECTION_PERMISSION_COPY,
    type ConnectionPermission,
} from '../../utils/connectionPermissions'
import { useStyles } from './styles'

export type PermissionItemProps = {
    permission: ConnectionPermission
}

export const PermissionItem = ({ permission }: PermissionItemProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.permissionItemContainer}>
            <PWIcon
                name='check'
                variant='positive'
            />
            <PWText>{t(CONNECTION_PERMISSION_COPY[permission])}</PWText>
        </PWView>
    )
}
