import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    container: {
        backgroundColor: theme.colors.background,
        paddingBottom: theme.spacing.xl,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.md,
    },
    headerSpacer: {
        width: 24,
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
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
        fontSize: 16,
        fontWeight: '500',
        color: theme.colors.textMain,
        marginBottom: 2,
    },
    listSubtitle: {
        fontSize: 13,
        color: theme.colors.textGray,
    },
    checkIcon: {
        backgroundColor: theme.colors.helperPositive + '1A', // 10% opacity roughly
        borderRadius: 20,
        padding: 4,
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
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.grey2,
        paddingBottom: theme.spacing.xs,
        marginHorizontal: theme.spacing.xs,
    },
    activeDateInput: {
        borderBottomColor: theme.colors.textMain,
        borderBottomWidth: 2,
    },
    dateLabel: {
        fontSize: 13,
        color: theme.colors.textGray,
        marginBottom: theme.spacing.xs,
    },
    dateValue: {
        fontSize: 16,
        color: theme.colors.textMain,
    },
    datePickerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 200,
    },
    datePicker: {
        height: 200,
        width: '100%',
    },
    doneButton: {
        color: theme.colors.linkPrimary,
        fontSize: 17,
        fontWeight: '600',
    },
    closeButton: {
        marginTop: theme.spacing.lg,
        marginHorizontal: theme.spacing.lg,
    },
}))
