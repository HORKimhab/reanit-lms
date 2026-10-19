// Test double for next/cache: cache revalidation needs a running Next server, so it is a boundary whose calls tests record.
// Use with: vi.mock("next/cache", () => import("@/test/cache"));
import { vi } from "vitest";

/** Records which paths a server action refreshed. */
export const revalidatePath = vi.fn();
