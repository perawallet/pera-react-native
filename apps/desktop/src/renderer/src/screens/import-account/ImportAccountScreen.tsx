/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

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
