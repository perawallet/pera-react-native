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
import type { EdgeInsets } from 'react-native-safe-area-context'

export const useStyles = makeStyles((theme, insets?: EdgeInsets) => {
    return {
        container: {
            flex: 1,
            marginBottom: insets?.bottom ?? 0,
        },
        listContainer: {
            flexGrow: 1,
            padding: theme.spacing.xl,
        },
        emptyView: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.colors.background,
        },
        listFooter: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        sessionItem: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
            paddingBottom: theme.spacing.xl,
            marginBottom: theme.spacing.md,
            borderBottomWidth: theme.borders.sm,
            borderBottomColor: theme.colors.layerGray,
        },
        sessionDate: {
            color: theme.colors.textGray,
        },
        sessionInfo: {
            flex: 1,
            alignItems: 'flex-start',
        },
        sessionNameContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            flex: 1,
        },
        sessionStatusContainer: {
            marginVertical: theme.spacing.sm,
        },
        sessionName: {
            flexShrink: 1,
            flexGrow: 1,
        },
        icon: {
            width: theme.spacing.xxl,
            height: theme.spacing.xxl,
            borderRadius: theme.spacing.xl,
            overflow: 'hidden',
        },
        iconFallback: {
            width: theme.spacing.xxl,
            height: theme.spacing.xxl,
            borderRadius: theme.spacing.xl,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.layerGrayLighter,
        },
        sessionOrigin: {
            color: theme.colors.textGray,
        },
        chevron: {
            alignSelf: 'center',
        },
    }
})
