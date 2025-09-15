import { makeStyles } from "@rneui/themed";
import { PropsWithChildren } from "react";

export const useStyles = makeStyles((theme, _: PropsWithChildren) => {
    return {
        mainContainer: {
            flex: 1,
            backgroundColor: theme.colors.background,
            color: theme.colors.white
        }
    }
})