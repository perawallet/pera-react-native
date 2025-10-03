import { NativeStackHeaderProps } from '@react-navigation/native-stack';
import PeraView from '../view/PeraView';
import { Text } from '@rneui/themed';
import ChevronLeft from '../../../../assets/icons/chevron-left.svg';
import { useStyles } from './styles';
import { TouchableOpacity } from 'react-native';

const NavigationHeader = (props: NativeStackHeaderProps) => {
  const styles = useStyles();

  return (
    <PeraView style={styles.container}>
      {props.navigation.canGoBack() && (
        <TouchableOpacity
          onPress={props.navigation.goBack}
          style={styles.backIconContainer}
        >
          <ChevronLeft style={styles.backIcon} />
        </TouchableOpacity>
      )}
      <Text h4 style={styles.title}>
        {props.options.title || props.route.name}
      </Text>
      {props.options.headerRight && props.options.headerRight({})}
      {!props.options.headerRight && props.navigation.canGoBack() && (
        <PeraView style={styles.backIconContainer} />
      )}
    </PeraView>
  );
};

export default NavigationHeader;
