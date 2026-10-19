/**
 * Shown instead of a list or page body that has nothing in it yet.
 *
 * @param props - Component props.
 * @param props.title - What is missing, such as "No courses yet".
 * @param props.text - Where it will come from, or what to do meanwhile.
 * @returns A dashed box with the title and text.
 */
export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
