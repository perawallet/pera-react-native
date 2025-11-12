import { Text } from "@rneui/themed"
import PWTouchableOpacity from "../touchable-opacity/PWTouchableOpacity"
import PWView from "../view/PWView"
import { useStyles } from "./styles"

import DeleteIcon from '../../../../assets/icons/delete.svg'

type NumberPadProps = {
    onPress: (key?: string) => void
}

const padArrangment = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', undefined],
]

const NumberPad = ({ onPress }: NumberPadProps) => {
    const styles = useStyles()
    return <PWView style={styles.container}>
        {padArrangment.map((row, idx) => <PWView style={styles.row} key={`numpad-row-${idx}`}>
            {row.map((key) => <PWTouchableOpacity key={`numpad-key-${key}`} onPress={() => onPress(key)} style={styles.key}>
                    {!!key && <Text h2>{key}</Text>}
                    {!key && <DeleteIcon width={24} height={24} />}
                </PWTouchableOpacity>
            )}           
        </PWView>
        )}
    </PWView>
}

export default NumberPad
