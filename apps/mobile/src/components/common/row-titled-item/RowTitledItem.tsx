import { PropsWithChildren } from "react";
import PWView, { PWViewProps } from "../view/PWView";
import { useStyles } from "./styles";
import { Text } from "@rneui/themed";

type RowTitledItemProps = {
    title: string
} & PWViewProps

const RowTitledItem = ({title, children, ...rest}: RowTitledItemProps) => {
    const styles = useStyles()
    return <PWView {...rest} style={[rest.style, styles.container]}>
        <Text style={styles.label}>{title}</Text>
        <PWView style={styles.childContainer}>
            {children}
        </PWView>
    </PWView>
}

export default RowTitledItem