import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Text } from "@react-email/components";
import type * as React from "react";

/** The platform's green, shown on buttons; matches the web app's default brand color. */
const BUTTON_COLOR = "#008b52";
const FONT = "'Kantumruy Pro', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * The frame every email shares: a centered card with a heading, the body, one button and a footer,
 * with links under it when the email can be turned off.
 *
 * @param props - Layout props.
 * @param props.lang - The email's language, for screen readers and fonts.
 * @param props.preview - Inbox preview line.
 * @param props.heading - The card's heading.
 * @param props.action - The button's label and link.
 * @param props.action.label - What the button says.
 * @param props.action.href - Where it goes.
 * @param props.footer - Who sent the email.
 * @param props.footerLinks - Links under the footer, such as unsubscribe.
 * @param props.children - The body, above the button.
 * @returns The email document.
 */
export function EmailLayout({
  lang,
  preview,
  heading,
  action,
  footer,
  footerLinks = [],
  children,
}: {
  lang: string;
  preview: string;
  heading: string;
  action: { label: string; href: string };
  footer: string;
  footerLinks?: { label: string; href: string }[];
  children: React.ReactNode;
}) {
  return (
    <Html lang={lang}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: FONT, margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 12, maxWidth: 520, padding: 32 }}>
          <Heading as="h1" style={{ fontSize: 22, margin: "0 0 16px" }}>
            {heading}
          </Heading>
          {children}
          <Button
            href={action.href}
            style={{ backgroundColor: BUTTON_COLOR, borderRadius: 8, color: "#ffffff", fontWeight: 600, padding: "12px 20px" }}
          >
            {action.label}
          </Button>
          <Hr style={{ borderColor: "#e4e4e7", margin: "32px 0 16px" }} />
          <Text style={{ color: "#71717a", fontSize: 12, margin: 0 }}>{footer}</Text>
          {footerLinks.map((link) => (
            <Text key={link.href} style={{ fontSize: 12, margin: "8px 0 0" }}>
              <Link href={link.href} style={{ color: "#71717a", textDecoration: "underline" }}>
                {link.label}
              </Link>
            </Text>
          ))}
        </Container>
      </Body>
    </Html>
  );
}
