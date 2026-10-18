import { cn } from "@reanit/ui/lib/utils";

/**
 * A school's square logo: its uploaded image, or its initial on the brand color.
 *
 * @param props - Component props.
 * @param props.name - The school's name, for the initial.
 * @param props.logoUrl - The logo image, if any.
 * @param props.label - Accessible name; leave out when the school's name is shown next to the logo.
 * @param props.className - Extra classes for the square.
 * @returns The logo, decorative unless labelled.
 */
export function SchoolLogo({
  name,
  logoUrl,
  label,
  className,
}: {
  name: string;
  logoUrl?: string;
  label?: string;
  className?: string;
}) {
  const box = cn("size-8 shrink-0 rounded-md", className);
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- a data URL or user upload at 32 px; next/image adds nothing
    return <img src={logoUrl} alt={label ?? ""} className={cn(box, "object-cover")} />;
  }
  return (
    <span
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={cn(box, "flex items-center justify-center bg-primary text-sm font-semibold text-primary-foreground")}
    >
      {name.charAt(0)}
    </span>
  );
}
