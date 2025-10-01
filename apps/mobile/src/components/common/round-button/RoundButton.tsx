import { useStyles } from './styles';
import {
  StyleProp,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native';
import PeraView from '../view/PeraView';
import { Text } from '@rneui/themed';

export type RoundButtonProps = {
  icon: React.ReactElement<{}>;
  title?: string;
  textStyle?: StyleProp<TextStyle>;
  buttonStyle?: StyleProp<ViewStyle>;
} & TouchableOpacityProps;

const RoundButton = (props: RoundButtonProps) => {
  const style = useStyles(props);
  const {
    icon,
    title,
    buttonStyle,
    textStyle,
    style: propStyle,
    ...rest
  } = props;

  return (
    <PeraView style={propStyle}>
      <TouchableOpacity style={[style.buttonStyle, buttonStyle]} {...rest}>
        {icon}
      </TouchableOpacity>
      <Text style={[style.titleStyle, textStyle]}>{title}</Text>
    </PeraView>
  );
};

export default RoundButton;
