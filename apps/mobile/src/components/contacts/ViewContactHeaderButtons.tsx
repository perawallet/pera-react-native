import { ParamListBase, useNavigation } from '@react-navigation/native';
import EditIcon from '../../../assets/icons/edit-pen.svg';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@rneui/themed';

const ViewContactHeaderButtons = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const goToAdd = () => {
    navigation.navigate('EditContact');
  };

  return <EditIcon onPress={goToAdd} color={theme.colors.textMain} />;
};

export default ViewContactHeaderButtons;
