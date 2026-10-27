// @vitest-environment node
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onApi, requestTo } from "@/test/api";
import { formData as form } from "@/test/form";
import { signIn } from "@/test/session";

import { savePayoutAccount } from "./actions";

vi.mock("next/headers", () => import("@/test/headers"));
// Cache revalidation needs a running Next server; it is a boundary, so record calls instead.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ROUTE = "PUT /schools/current/payout-account";
const ACCOUNT = { holderName: "Dara Kim", bankName: "ABA", account: "000 123 456" };

beforeEach(() => {
  signIn();
});

describe("savePayoutAccount", () => {
  it("saves the trimmed details and refreshes the payouts page", async () => {
    onApi(ROUTE, Response.json({ account: ACCOUNT }));

    expect(await savePayoutAccount({ status: "idle" }, form({ holderName: " Dara Kim ", bankName: "ABA ", account: " 000 123 456" }))).toEqual({ status: "saved" });
    expect(await requestTo(ROUTE)?.json()).toEqual(ACCOUNT);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/payouts");
  });

  it("rejects a blank field without calling the API", async () => {
    expect(await savePayoutAccount({ status: "idle" }, form({ ...ACCOUNT, bankName: "  " }))).toEqual({ status: "invalid" });
    expect(requestTo(ROUTE)).toBeUndefined();
  });
});
