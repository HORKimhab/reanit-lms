import { Button } from "@reanit/ui/components/button";
import { cn } from "@reanit/ui/lib/utils";

import { INPUT_CLASS } from "@/components/form/field";

/**
 * A list's search box: it reloads the page with `?q=` and starts again from the first page.
 *
 * @param props - Component props.
 * @param props.id - The input's id.
 * @param props.label - The input's label and placeholder.
 * @param props.button - The submit button's label.
 * @param props.q - The search the page was loaded with, if any.
 * @returns The search form.
 */
export function SearchForm({ id, label, button, q }: { id: string; label: string; button: string; q?: string }) {
  return (
    <form role="search" className="flex gap-2">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input id={id} type="search" name="q" defaultValue={q} placeholder={label} className={cn(INPUT_CLASS, "w-full max-w-sm")} />
      <Button type="submit" variant="outline">
        {button}
      </Button>
    </form>
  );
}
