import * as React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Text } from '@react-email/components'
import { brand } from './_brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your GrowNowNow verification code</Preview>
    <Body style={brand.main}>
      <Container style={brand.container}>
        <Text style={brand.brandMark}>GrowNowNow</Text>
        <Heading style={brand.h1}>Confirm it's you</Heading>
        <Text style={brand.text}>Use this code to confirm your identity:</Text>
        <Text style={brand.code}>{token}</Text>
        <Hr style={brand.divider} />
        <Text style={brand.footer}>
          This code expires shortly. Didn't request it? You can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
