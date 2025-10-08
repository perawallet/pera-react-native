import styled from 'styled-components'

const Container = styled.div`
  padding: var(--spacing-xl);
`

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: var(--spacing-lg);
  color: var(--color-text-main);
`

const Subtitle = styled.p`
  color: var(--color-text-gray);
  margin-bottom: var(--spacing-lg);
`

const FormContainer = styled.div`
  margin-top: var(--spacing-lg);
`

const FormGroup = styled.div`
  margin-bottom: var(--spacing-lg);
`

const Label = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: var(--spacing-sm);
  color: var(--color-text-main);
`

const Textarea = styled.textarea`
  width: 100%;
  padding: var(--spacing-lg);
  border: 1px solid var(--color-grey2);
  border-radius: var(--spacing-sm);
  height: 6rem;
  font-size: 1rem;
  color: var(--color-text-main);
  background-color: var(--color-background);
  resize: vertical;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
  }
`

const Input = styled.input`
  width: 100%;
  padding: var(--spacing-lg);
  border: 1px solid var(--color-grey2);
  border-radius: var(--spacing-sm);
  font-size: 1rem;
  color: var(--color-text-main);
  background-color: var(--color-background);

  &:focus {
    outline: none;
    border-color: var(--color-primary);
  }
`

const ImportButton = styled.button`
  padding: var(--spacing-lg) var(--spacing-xl);
  background-color: var(--color-primary);
  color: var(--color-white);
  border: none;
  border-radius: var(--spacing-sm);
  font-size: 1rem;
  cursor: pointer;
`

const ImportAccountScreen = () => {
  return (
    <Container>
      <Title>Import Account</Title>
      <Subtitle>Import your existing account using recovery phrase or private key</Subtitle>
      <FormContainer>
        <FormGroup>
          <Label>Recovery Phrase</Label>
          <Textarea placeholder="Enter your 25-word recovery phrase" />
        </FormGroup>
        <FormGroup>
          <Label>Private Key (optional)</Label>
          <Input placeholder="Enter private key" />
        </FormGroup>
        <ImportButton>Import Account</ImportButton>
      </FormContainer>
    </Container>
  );
};

export default ImportAccountScreen;
