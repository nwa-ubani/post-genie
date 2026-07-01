import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Text } from '@react-email/components'
import { brand } from './_brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your sign-in link for {siteName}</Preview>
    <Body style={brand.main}>
      <Container style={brand.container}>
        <Text style={brand.brandMark}>{siteName}</Text>
        <Heading style={brand.h1}>Your sign-in link</Heading>
        <Text style={brand.text}>Click below to sign in to {siteName}. This link expires shortly.</Text>
        <Button style={brand.button} href={confirmationUrl}>Sign in</Button>
        <Hr style={brand.divider} />
        <Text style={brand.footer}>Didn't request this? You can safely ignore this email.</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
