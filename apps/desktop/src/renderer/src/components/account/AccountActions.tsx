import { ActionsContainer, StyledButton } from './AccountActions.styles';

const AccountActions = () => {
  return (
    <ActionsContainer>
      <StyledButton className="export">
        📤 Export Private Key
      </StyledButton>
      <StyledButton className="delete">
        🗑️ Delete Account
      </StyledButton>
    </ActionsContainer>
  );
};

export default AccountActions;
