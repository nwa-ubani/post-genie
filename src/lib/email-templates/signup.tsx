import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Text } from '@react-email/components'
import { brand } from './_brand'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email to start posting with {siteName}</Preview>
    <Body style={brand.main}>
      <Container style={brand.container}>
        <Text style={brand.brandMark}>{siteName}</Text>
        <Heading style={brand.h1}>Confirm your email</Heading>
        <Text style={brand.text}>
          Thanks for signing up for{' '}
          <Link href={siteUrl} style={brand.link}>{siteName}</Link>. Confirm{' '}
          <Link href={`mailto:${recipient}`} style={brand.link}>{recipient}</Link> to finish setting up your daily LinkedIn posts.
        </Text>
        <Button style={brand.button} href={confirmationUrl}>Verify email</Button>
        <Hr style={brand.divider} />
        <Text style={brand.footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
