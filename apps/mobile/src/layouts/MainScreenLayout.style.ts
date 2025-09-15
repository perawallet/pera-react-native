import { makeStyles } from "@rneui/themed";
import { PropsWithChildren } from "react";

export const useStyles = makeStyles((theme, _: PropsWithChildren) => {
    return {
        mainContainer: {
            flex: 1,
            backgroundColor: theme.colors.background,
            padding: theme.spacing.lg,
        },
        testnetContainer: {
            backgroundColor: theme.colors.primary,
            height: theme.spacing.lg * 2
        }
    }
})