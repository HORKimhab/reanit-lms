import { createStaffNoticeStore, type DbClient } from "@reanit/db";
import { DB_CLIENT } from "@reanit/nest";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { openSchool, uniqueName, useE2eApp } from "../src/test/e2e";

const e2e = useE2eApp();

describe("notifications", () => {
  it("saves an owner's email settings, which an unsubscribe link then changes without signing in", async () => {
    const { agent, school } = await openSchool(e2e().app, uniqueName("notify"));
    expect((await agent.get("/notifications/preferences").expect(200)).body).toEqual({
      preferences: { newSale: true, newComment: true, courseCompleted: true, locale: "en" },
    });

    await agent.put("/notifications/preferences").send({ newSale: true, newComment: true, courseCompleted: false, locale: "km" }).expect(200);
    // Only the owner's emails carry their token, so read it as the worker does when it sends one.
    const [owner] = await createStaffNoticeStore(e2e().app.get<DbClient>(DB_CLIENT), school.id).findRecipients("newSale", ["owner"]);

    const stopped = await request(e2e().app.getHttpServer()).post("/notifications/unsubscribe").send({ token: owner!.unsubscribeToken, kind: "newSale" }).expect(200); // the school has an owner
    expect(stopped.body).toEqual({ schoolName: school.name });
    expect((await agent.get("/notifications/preferences").expect(200)).body.preferences).toEqual({
      newSale: false,
      newComment: true,
      courseCompleted: false,
      locale: "km",
    });
  });

  it("refuses an unsubscribe link with an unknown token", async () => {
    const response = await request(e2e().app.getHttpServer())
      .post("/notifications/unsubscribe")
      .send({ token: "6f1c1f3e-1c5a-4a8e-9a39-2c1f1d9e0a01", kind: "newSale" })
      .expect(404);

    expect(response.body.type).toBe("urn:reanit:problem:invalid-unsubscribe-link");
  });
});
