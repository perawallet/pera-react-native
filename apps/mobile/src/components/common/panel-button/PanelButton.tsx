import { useStyles } from './styles';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { Text } from '@rneui/themed';
import PeraView from '../view/PeraView';

export type PanelButtonProps = {
  leftIcon: React.ReactElement<{}>;
  rightIcon: React.ReactElement<{}>;
  title: string;
  titleWeight: 'h3' | 'h4';
  onPress: () => void;
} & TouchableOpacityProps;

const PanelButton = (props: PanelButtonProps) => {
  const themeStyle = useStyles(props);
  const { style, leftIcon, rightIcon, title, titleWeight, onPress, ...rest } =
    props;

  return (
    <TouchableOpacity onPress={onPress}>
      <PeraView style={[style, themeStyle.buttonStyle]} {...rest}>
        {leftIcon}
        <Text
          style={themeStyle.textStyle}
          h4={titleWeight === 'h4'}
          h3={titleWeight === 'h3'}
        >
          {title}
        </Text>
        {rightIcon}
      </PeraView>
    </TouchableOpacity>
  );
};

export default PanelButton;
