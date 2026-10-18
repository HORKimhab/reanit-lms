import { notFound } from "next/navigation";

import { PlayerShell } from "@/components/player/player-shell";
import { getMockEnrollment } from "@/mocks/enrollments";

/**
 * Player layout. 404s when the student is not enrolled.
 *
 * @param props - Layout props.
 * @param props.children - The lesson page.
 * @param props.params - Route params with the school and course slugs.
 * @returns The player shell around the lesson.
 * @throws {Error} Next's not-found signal when the student is not enrolled in the course.
 */
export default async function PlayerLayout({ children, params }: LayoutProps<"/[locale]/s/[school]/learn/[course]">) {
  const { school, course } = await params;
  const enrollment = getMockEnrollment(school, course);
  if (!enrollment) notFound();
  return (
    <PlayerShell school={school} enrollment={enrollment}>
      {children}
    </PlayerShell>
  );
}
