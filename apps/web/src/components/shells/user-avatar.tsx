import { MOCK_USER } from "@/mocks/schools";

/**
 * The signed-in user's initials in a circle.
 *
 * @returns An image-role avatar labelled with the user's name.
 */
export function UserAvatar() {
  return (
    <span
      role="img"
      aria-label={MOCK_USER.name}
      className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
    >
      {MOCK_USER.initials}
    </span>
  );
}
