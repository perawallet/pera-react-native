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
            backgroundColor: theme.colors.background,
            flex: 1,
        },
        errorContainer: {
            alignItems: 'center',
            flex: 1,
            gap: theme.spacing.md,
            justifyContent: 'center',
            marginHorizontal: theme.spacing.lg,
        },
        errorDescription: {
            color: theme.colors.textGray,
            textAlign: 'center',
        },
        errorTitle: {
            textAlign: 'center',
        },
        list: {
            flex: 1,
        },
        listContentContainer: {
            gap: theme.spacing.md,
            paddingBottom: theme.spacing.xxl,
            paddingHorizontal: theme.spacing.md,
        },
        skeletonContainer: {
            gap: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
        },
        skeletonCard: {
            flexDirection: 'row',
            gap: theme.spacing.md,
            paddingHorizontal: theme.spacing.sm,
            paddingTop: theme.spacing.lg,
        },
        skeletonDescription: {
            borderRadius: theme.spacing.sm,
            height: 36,
            width: '100%',
        },
        skeletonContent: {
            width: '100%',
            flexShrink: 1,
        },
        skeletonTitle: {
            borderRadius: theme.spacing.sm,
            height: 18,
            width: '40%',
            marginBottom: theme.spacing.sm,
        },
        skeletonTvlRow: {
            borderRadius: theme.spacing.sm,
            height: 14,
            width: '50%',
            marginTop: theme.spacing.sm,
        },
        subtitle: {
            fontSize: 15,
            color: theme.colors.textGray,
            marginBottom: theme.spacing.lg,
            marginHorizontal: theme.spacing.lg,
        },
        toolbar: {
            marginHorizontal: theme.spacing.lg,
            marginTop: theme.spacing.sm,
        },
    }
})
