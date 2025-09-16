import { makeStyles } from "@rneui/themed";
import { MainScreenLayoutProps } from "./MainScreenLayout";

export const useStyles = makeStyles((theme, props: MainScreenLayoutProps) => {
    return {
        mainContainer: {
            flex: 1,
            backgroundColor: theme.colors.background,
        },
        testnetContainer: {
            backgroundColor: theme.colors.primary,
            height: theme.spacing.lg * 2
        }
    }
})