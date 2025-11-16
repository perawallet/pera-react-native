import { Text } from '@rneui/themed';
import PWTouchableOpacity from '../touchable-opacity/PWTouchableOpacity';
import { useStyles } from './styles';
import PWView from '../view/PWView';

type RadioButtonProps = {
  onPress: () => void;
  title: string;
  selected: boolean;
};
const RadioButton = ({ onPress, title, selected }: RadioButtonProps) => {
  const styles = useStyles();

  return (
    <PWTouchableOpacity onPress={onPress} style={styles.row}>
      <Text h4>{title}</Text>
      <PWView style={styles.radioContainer}>
        {selected && <PWView style={styles.selectedRadio} />}
      </PWView>
    </PWTouchableOpacity>
  );
};

export default RadioButton;
