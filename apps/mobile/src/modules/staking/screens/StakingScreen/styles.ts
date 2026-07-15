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

import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => {
    return {
        container: {
            backgroundColor: theme.colors.background,
        },
        errorContainer: {
            alignItems: 'center',
            flex: 1,
            gap: theme.spacing.md,
            justifyContent: 'center',
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
        skeletonContainer: {
            gap: theme.spacing.lg,
            paddingVertical: 0,
            justifyContent: 'flex-start',
        },
        skeletonCard: {
            flexDirection: 'row',
            gap: theme.spacing.md,
            paddingTop: theme.spacing.lg,
        },
        skeletonLogo: {
            width: theme.spacing.xxl,
            height: theme.spacing.xxl,
            borderWidth: 0,
        },
        skeletonDescription: {
            borderRadius: theme.spacing.sm,
            height: theme.spacing.xxl,
        },
        skeletonContent: {
            gap: theme.spacing.xs,
            width: '100%',
            flexShrink: 1,
        },
        skeletonTitle: {
            borderRadius: theme.spacing.sm,
            height: theme.spacing.xl,
            width: '40%',
            marginBottom: theme.spacing.sm,
        },
        skeletonTvlRow: {
            borderRadius: theme.spacing.sm,
            height: theme.spacing.md,
            width: '50%',
            marginTop: theme.spacing.sm,
        },
        subtitle: {
            color: theme.colors.textGray,
            marginVertical: theme.spacing.lg,
        },
    }
})
