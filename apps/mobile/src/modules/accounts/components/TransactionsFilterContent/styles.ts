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
const DATE_PICKER_HEIGHT = 200

export const useStyles = makeStyles(theme => {
    return {
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
        },
        headerSpacer: {
            width: theme.spacing.xl,
        },
        title: {
            color: theme.colors.textMain,
        },
        listItem: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: theme.spacing.lg,
            paddingHorizontal: theme.spacing.lg,
        },
        listIcon: {
            marginRight: theme.spacing.md,
        },
        listContent: {
            flex: 1,
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
        },
        customRangeContainer: {
            paddingHorizontal: theme.spacing.lg,
        },
        dateInputsContainer: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: theme.spacing.md,
            marginBottom: theme.spacing.xl,
        },
        dateInputWrapper: {
            flex: 1,
            borderBottomWidth: theme.borders.sm,
            borderBottomColor: theme.colors.layerGray,
            paddingBottom: theme.spacing.xs,
            marginHorizontal: theme.spacing.xs,
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
        datePickerContainer: {
            alignItems: 'center',
            justifyContent: 'center',
            height: DATE_PICKER_HEIGHT,
        },
        datePicker: {
            height: DATE_PICKER_HEIGHT,
            width: '100%' as const,
        },
        doneButton: {
            color: theme.colors.linkPrimary,
        },
        closeButton: {
            marginTop: theme.spacing.lg,
            marginHorizontal: theme.spacing.lg,
        },
    }
})
