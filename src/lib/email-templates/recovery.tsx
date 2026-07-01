import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Text } from '@react-email/components'
import { brand } from './_brand'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your {siteName} password</Preview>
    <Body style={brand.main}>
      <Container style={brand.container}>
        <Text style={brand.brandMark}>{siteName}</Text>
        <Heading style={brand.h1}>Reset your password</Heading>
        <Text style={brand.text}>
          We got a request to reset the password for your {siteName} account. Choose a new one below.
        </Text>
        <Button style={brand.button} href={confirmationUrl}>Reset password</Button>
        <Hr style={brand.divider} />
        <Text style={brand.footer}>
          Didn't request this? Your password stays the same — you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
