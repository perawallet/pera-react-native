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

import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => {
    return {
        container: {
            flex: 1,
            gap: theme.spacing.xl,
            padding: theme.spacing.xl,
        },
        icon: {
            width: theme.spacing.xl * 3,
            height: theme.spacing.xl * 3,
            borderRadius: theme.spacing.xl * 3,
        },
        iconContainer: {
            width: theme.spacing.xl * 3,
            height: theme.spacing.xl * 3,
            borderRadius: theme.spacing.xl * 3,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.colors.layerGrayLighter,
        },
        headerContainer: {
            alignItems: 'center',
            marginHorizontal: theme.spacing.xl,
            gap: theme.spacing.xl,
        },
        titleContainer: {
            alignItems: 'center',
            marginHorizontal: theme.spacing.xl,
        },
        title: {
            textAlign: 'center',
        },
        networksContainer: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: theme.spacing.sm,
        },
        permissionsContainer: {
            backgroundColor: theme.colors.layerGrayLighter,
            borderRadius: theme.spacing.lg,
            gap: theme.spacing.md,
            padding: theme.spacing.lg,
            width: '100%',
        },
        accountSelectionContainer: {
            flexGrow: 1,
        },
        permissionItemContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
        },
        permissionsTitle: {
            color: theme.colors.textGray,
            marginBottom: theme.spacing.md,
        },
        accountsContainer: {

        },
        buttonContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
        },
        cancelButton: {
            flexGrow: 1,
        },
        connectButton: {
            flexGrow: 2,
        }
    }
})
