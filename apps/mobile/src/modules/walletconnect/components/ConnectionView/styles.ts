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
            padding: theme.spacing.xl,
        },
        contentContainer: {
            gap: theme.spacing.md,
            paddingBottom: theme.spacing.xl,
        },
        icon: {
            width: theme.spacing['4xl'],
            height: theme.spacing['4xl'],
            borderRadius: theme.spacing['4xl'],
            marginVertical: theme.spacing.md,
        },
        iconContainer: {
            width: theme.spacing['4xl'],
            height: theme.spacing['4xl'],
            borderRadius: theme.spacing['4xl'],
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.colors.layerGrayLighter,
        },
        headerContainer: {
            alignItems: 'center',
            gap: theme.spacing.xl,
        },
        titleContainer: {
            alignItems: 'center',
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
            marginTop: theme.spacing.lg,
            alignSelf: 'flex-start',
        },
        permissionsTitle: {
            color: theme.colors.textGray,
            marginBottom: theme.spacing.md,
        },
        accountsContainer: {
            gap: theme.spacing.md,
            flexGrow: 1,
            flexShrink: 1,
        },
        buttonContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
            marginVertical: theme.spacing.lg,
            marginHorizontal: theme.spacing.xl,
        },
        cancelButton: {
            flexGrow: 1,
        },
        connectButton: {
            flexGrow: 2,
        },
        accountItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
        },
    }
})
