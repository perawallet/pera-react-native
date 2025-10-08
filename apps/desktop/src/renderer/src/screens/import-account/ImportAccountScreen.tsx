import {
  Container,
  Title,
  Subtitle,
  FormContainer,
  FormGroup,
  Label,
  Textarea,
  Input,
  ImportButton
} from './ImportAccountScreen.styles'

const ImportAccountScreen = (): React.ReactElement => {
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
  )
}

export default ImportAccountScreen
