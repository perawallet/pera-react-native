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
        sessionItem: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.xl,
            marginBottom: theme.spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.layerGray,
        },
        sessionInfo: {
            flex: 1,
            gap: theme.spacing.sm,
            alignItems: 'flex-start',
        },
        sessionNameContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
        },
        icon: {
            width: theme.spacing.xl * 1.5,
            height: theme.spacing.xl * 1.5,
            borderRadius: theme.spacing.xl,
            overflow: 'hidden',
        },
        sessionDate: {
            color: theme.colors.textGray,
            fontSize: theme.spacing.md,
        },
        chevron: {
            alignSelf: 'center',
        },
    }
})
