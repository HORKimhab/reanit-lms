import type * as React from "react";
import { Button } from "@reanit/ui/components/button";
import { Card, CardDescription, CardTitle } from "@reanit/ui/components/card";

import { ThemeToggle } from "@/components/theme-toggle";

// Placeholder home: shows the design tokens until the real screens (WEB-03+) land.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-10 px-6 py-12">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold">Reanit</span>
        <ThemeToggle />
      </header>

      <section className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold tracking-tight">Teach what you know.</h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Open your own school, build courses and sell them to students.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg">Create your school</Button>
          <Button size="lg" variant="outline">
            Browse courses
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { title: "Build", text: "Sections, lessons, video and PDFs." },
          { title: "Sell", text: "One-time prices, coupons and bundles." },
          { title: "Teach", text: "Progress tracking and certificates." },
        ].map((item) => (
          <Card key={item.title}>
            <CardTitle>{item.title}</CardTitle>
            <CardDescription>{item.text}</CardDescription>
          </Card>
        ))}
      </section>

      {/* A school overrides --brand on a wrapper element. */}
      <section style={{ "--brand": "oklch(0.6 0.2 30)" } as React.CSSProperties} className="flex gap-3">
        <Button>School brand color</Button>
        <Button variant="link">Brand link</Button>
      </section>
    </main>
  );
}
