import { makeStyles } from "@rneui/themed";
import { PropsWithChildren } from "react";

export const useStyles = makeStyles((theme, _: PropsWithChildren) => {
    return {
        layout: {
            padding: 0,
        },
        mainContainer: {
            backgroundColor: theme.colors.background,
            color: theme.colors.white,
            flexDirection: 'column',
            paddingHorizontal: theme.spacing.xl
        },
        headerContainer: {
            flexDirection: 'row',
            marginBottom: theme.spacing.lg * 3
        },
        headerImage: {
            width: 172,
            borderWidth: 1,
            borderColor: theme.colors.error
        },
        headerTitle: {
            paddingStart: theme.spacing.lg,
            borderWidth: 1,
            verticalAlign: 'bottom'
        },
        buttonTitle: {
            marginTop: theme.spacing.xl,
            marginBottom: theme.spacing.sm,
            color: theme.colors.textGray
        }

    }
})