import { playerLessons } from "@reanit/core/learning";

import { PlayerShell } from "@/components/player/player-shell";
import { getPlayerCourse } from "@/server/learning/player";

/**
 * Player layout for an enrolled student. Signed-out visitors log in first; anyone else 404s.
 *
 * @param props - Layout props.
 * @param props.children - The lesson page.
 * @param props.params - Route params with the school's subdomain and the course slug.
 * @returns The player shell around the lesson.
 * @throws {Error} Next's redirect signal when signed out, or its not-found signal when the student does not have the course.
 */
export default async function PlayerLayout({ children, params }: LayoutProps<"/[locale]/s/[school]/learn/[course]">) {
  const { school, course: slug } = await params;
  const course = await getPlayerCourse(school, decodeURIComponent(slug));
  return (
    <PlayerShell school={school} title={course.title} lessons={playerLessons(course, course.progress, new Date())} base={`/s/${school}/learn/${course.slug}`}>
      {children}
    </PlayerShell>
  );
}
