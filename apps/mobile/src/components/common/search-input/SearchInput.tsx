import { InputProps } from '@rneui/base';

import SearchIcon from '../../../../assets/icons/magnifying-glass.svg';
import { Input, useTheme } from '@rneui/themed';
import { useStyles } from './styles';

type SearchInputProps = {} & Omit<InputProps, 'leftIcon'>;

const SearchInput = (props: SearchInputProps) => {
  const { theme } = useTheme();
  const styles = useStyles();

  return (
    <Input
      {...props}
      inputContainerStyle={[props.inputContainerStyle, styles.search]}
      placeholder={props.placeholder ?? 'Search'}
      leftIcon={<SearchIcon color={theme.colors.textGray} />}
    />
  );
};

export default SearchInput;
