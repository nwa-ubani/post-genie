import React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { brand } from './_brand'

interface Props {
  name?: string
  daysRemaining?: number
  reconnectUrl?: string
}

const Email = ({ name, daysRemaining = 7, reconnectUrl = 'https://autopost.grownownow.com/settings' }: Props) => {
  const isLastDay = daysRemaining <= 1
  const headline = isLastDay
    ? 'Your LinkedIn connection expires tomorrow'
    : daysRemaining >= 14
      ? 'Your LinkedIn connection expires in 2 weeks'
      : `${daysRemaining} days left to reconnect LinkedIn`

  const preview = isLastDay
    ? 'Reconnect today so your Auto-Post publishing doesn\'t stop.'
    : `Reconnect LinkedIn to keep your daily posts going.`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={brand.main}>
        <Container style={brand.container}>
          <Text style={brand.brandMark}>Auto-Post</Text>
          <Heading style={brand.h1}>{headline}</Heading>
          <Text style={brand.text}>
            {name ? `Hi ${name},` : 'Hi there,'}
          </Text>
          <Text style={brand.text}>
            {isLastDay
              ? 'Your LinkedIn access token expires tomorrow. Once it lapses, Auto-Post will stop publishing your daily posts until you reconnect.'
              : `Your LinkedIn access token expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. To keep your daily thought-leader posts going without interruption, reconnect LinkedIn from your settings.`}
          </Text>
          <Text style={brand.text}>
            It takes about 15 seconds — click the button, approve on LinkedIn, and you're back on autopilot. Your scheduled posts resume as soon as you reconnect.
          </Text>
          <Section style={{ margin: '8px 0 24px' }}>
            <Button href={reconnectUrl} style={brand.button}>Reconnect LinkedIn</Button>
          </Section>
          <Text style={brand.footer}>
            You're receiving this because your LinkedIn connection in Auto-Post is about to expire. Manage notifications in Settings.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => {
    const days = Number(data.daysRemaining ?? 7)
    if (days <= 1) return 'Last day: your Auto-Post publishing stops tomorrow'
    if (days >= 14) return 'Your LinkedIn connection expires in 2 weeks'
    return `⏳ ${days} days left — reconnect LinkedIn to keep your posts going`
  },
  displayName: 'LinkedIn expiry reminder',
  previewData: { name: 'Faith', daysRemaining: 7, reconnectUrl: 'https://autopost.grownownow.com/settings' },
} satisfies TemplateEntry
