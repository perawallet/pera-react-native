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

import { PWText, PWView } from '@components/core'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { useStyles } from '@components/ConnectionApproval/styles'
import { useLanguage } from '@hooks/useLanguage'
import type { ConnectionPermission } from '../../utils/connectionPermissions'
import { PermissionItem } from '../PermissionItem'

export type ConnectionPermissionsPanelProps = {
    permissions: ConnectionPermission[]
}

export const ConnectionPermissionsPanel = ({
    permissions,
}: ConnectionPermissionsPanelProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <TitledExpandablePanel
            startExpanded
            containerStyle={styles.permissionsContainer}
            title={
                <PWText
                    variant='h4'
                    style={styles.panelTitle}
                >
                    {t('walletconnect.permissions.heading')}
                </PWText>
            }
        >
            <PWView style={styles.permissionsContent}>
                {permissions.map(permission => (
                    <PermissionItem
                        key={permission}
                        permission={permission}
                    />
                ))}
            </PWView>
        </TitledExpandablePanel>
    )
}
