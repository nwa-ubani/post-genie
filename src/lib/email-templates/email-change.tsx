import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Text } from '@react-email/components'
import { brand } from './_brand'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ siteName, oldEmail, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your new email for {siteName}</Preview>
    <Body style={brand.main}>
      <Container style={brand.container}>
        <Text style={brand.brandMark}>{siteName}</Text>
        <Heading style={brand.h1}>Confirm your new email</Heading>
        <Text style={brand.text}>
          You asked to change your {siteName} email from{' '}
          <Link href={`mailto:${oldEmail}`} style={brand.link}>{oldEmail}</Link> to{' '}
          <Link href={`mailto:${newEmail}`} style={brand.link}>{newEmail}</Link>.
        </Text>
        <Button style={brand.button} href={confirmationUrl}>Confirm email change</Button>
        <Hr style={brand.divider} />
        <Text style={brand.footer}>
          Didn't request this? Secure your account immediately by resetting your password.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
