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

const CHECK_ICON_RADIUS = 20

export const useStyles = makeStyles(theme => {
    return {
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: theme.spacing.xl,
            paddingVertical: theme.spacing.md,
            width: '100%',
            minWidth: 0,
            gap: theme.spacing.sm,
        },
        headerSpacer: {
            width: theme.spacing.xl,
            flexShrink: 0,
        },
        headerAction: {
            flexShrink: 0,
        },
        titleContainer: {
            flex: 1,
            minWidth: 0,
            alignItems: 'center',
        },
        title: {
            color: theme.colors.textMain,
            textAlign: 'center',
            width: '100%',
        },
        listItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: theme.spacing.lg,
            paddingHorizontal: theme.spacing.xl,
            width: '100%',
            minWidth: 0,
        },
        listIcon: {
            marginRight: theme.spacing.md,
            flexShrink: 0,
        },
        listContent: {
            flex: 1,
            minWidth: 0,
        },
        listTitle: {
            color: theme.colors.textMain,
            marginBottom: theme.spacing.xxs,
        },
        listSubtitle: {
            color: theme.colors.textGray,
        },
        checkIcon: {
            backgroundColor: theme.colors.positive + '1A', // 10% opacity roughly
            borderRadius: CHECK_ICON_RADIUS,
            padding: theme.spacing.xs,
            flexShrink: 0,
        },
        customRangeContainer: {
            paddingHorizontal: theme.spacing.xl,
            paddingBottom: theme.spacing.xl,
            width: '100%',
            minWidth: 0,
            overflow: 'hidden',
        },
        dateInputsContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: theme.spacing.md,
            marginBottom: theme.spacing.xl,
            width: '100%',
            minWidth: 0,
            gap: theme.spacing.md,
        },
        dateInputWrapper: {
            flex: 1,
            minWidth: 0,
            borderBottomWidth: theme.borders.sm,
            borderBottomColor: theme.colors.layerGray,
            paddingBottom: theme.spacing.xs,
        },
        activeDateInput: {
            borderBottomColor: theme.colors.textMain,
            borderBottomWidth: theme.borders.md,
        },
        dateLabel: {
            color: theme.colors.textGray,
            marginBottom: theme.spacing.xs,
        },
        dateValue: {
            color: theme.colors.textMain,
        },
        doneButton: {
            color: theme.colors.positive,
            flexShrink: 0,
        },
        closeButton: {
            marginTop: theme.spacing.lg,
            marginHorizontal: theme.spacing.xl,
        },
    }
})
