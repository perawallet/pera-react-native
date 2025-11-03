import { useStyles } from './styles';
import { View, ViewProps } from 'react-native';

export type PeraViewProps = ViewProps;

const PeraView = (props: PeraViewProps) => {
  const style = useStyles(props);

  return (
    <View style={[style.defaultStyle, props.style]} {...props}>
      {props.children}
    </View>
  );
};

export default PeraView;
