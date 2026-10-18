import { MOCK_USER } from "@/mocks/schools";

export function UserAvatar() {
  return (
    <span
      aria-label={MOCK_USER.name}
      className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
    >
      {MOCK_USER.initials}
    </span>
  );
}
