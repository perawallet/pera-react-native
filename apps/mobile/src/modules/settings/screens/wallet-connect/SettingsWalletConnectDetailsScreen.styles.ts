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
            gap: theme.spacing.lg,
            alignItems: 'flex-start',
        },
        versionContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
        },
        icon: {
            width: theme.spacing.xl * 2,
            height: theme.spacing.xl * 2,
            borderRadius: theme.spacing.xl,
        },
        link: {
            color: theme.colors.helperPositive,
        },
        description: {
            color: theme.colors.textGray,
        },
        version: {
            color: theme.colors.textGray,
        },
        connectionContainer: {
            padding: theme.spacing.md,
            borderRadius: theme.spacing.md,
            backgroundColor: theme.colors.layerGrayLighter,
            width: '100%',
        },
        createdAt: {
            color: theme.colors.textGray,
            flexGrow: 1,
            textAlign: 'right',
            alignSelf: 'flex-end',
        },
        accountDisplay: {
            flexGrow: 1,
        },
        networkContainer: {
            alignItems: 'center',
            gap: theme.spacing.xs,
        },
        mainnetText: {
            color: theme.colors.helperPositive,
            textTransform: 'uppercase',
            fontSize: 10,
        },
        testnetText: {
            color: theme.colors.testnetBackground,
            textTransform: 'uppercase',
            fontSize: 10,
        },
        accountContainer: {
            marginTop: theme.spacing.md,
            gap: theme.spacing.lg,
        },
        accountRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            width: '100%',
        },

        permissionsContainer: {
            marginTop: theme.spacing.lg,
            gap: theme.spacing.sm,
            width: '100%',
        },
        permissionsTitle: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingVertical: theme.spacing.md,
        },
        deleteContainer: {
            flexGrow: 1,
            width: '100%',
            justifyContent: 'flex-end',
        },
        expandIcon: {
            alignSelf: 'flex-end'
        },
        infoSheet: {
            padding: theme.spacing.xl,
            gap: theme.spacing.lg,
        }
    }
})
