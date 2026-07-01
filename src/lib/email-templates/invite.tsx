import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Text } from '@react-email/components'
import { brand } from './_brand'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to {siteName}</Preview>
    <Body style={brand.main}>
      <Container style={brand.container}>
        <Text style={brand.brandMark}>{siteName}</Text>
        <Heading style={brand.h1}>You're invited</Heading>
        <Text style={brand.text}>
          You've been invited to join{' '}
          <Link href={siteUrl} style={brand.link}>{siteName}</Link>. Accept below to create your account.
        </Text>
        <Button style={brand.button} href={confirmationUrl}>Accept invitation</Button>
        <Hr style={brand.divider} />
        <Text style={brand.footer}>Not expecting this? You can safely ignore this email.</Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
