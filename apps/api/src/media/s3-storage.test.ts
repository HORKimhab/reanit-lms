import { NotFound, S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { createS3Storage } from "./s3-storage";

const ENV = {
  S3_ENDPOINT: "http://storage:8333",
  S3_PUBLIC_ENDPOINT: "http://localhost:8333",
  S3_REGION: "auto",
  S3_BUCKET: "reanit-media",
  S3_ACCESS_KEY_ID: "key",
  S3_SECRET_ACCESS_KEY: "secret",
  S3_FORCE_PATH_STYLE: true,
};
const KEY = "schools/s1/lessons/l1/f1.mp4";

describe("createS3Storage", () => {
  it("signs an upload of exactly that type and size on the public endpoint", async () => {
    const { url, headers } = await createS3Storage(ENV).presignUpload({ key: KEY, contentType: "video/mp4", sizeBytes: 1234 }, 900);
    const signed = new URL(url);

    expect(`${signed.origin}${signed.pathname}`).toBe(`http://localhost:8333/reanit-media/${KEY}`);
    expect(signed.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(signed.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual(
      expect.arrayContaining(["content-length", "content-type", "host"]),
    );
    expect(headers).toEqual({ "content-type": "video/mp4" });
  });

  it("signs a download that expires", async () => {
    const url = new URL(await createS3Storage(ENV).presignDownload(KEY, 3600));

    expect(url.pathname).toBe(`/reanit-media/${KEY}`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("signs on the server endpoint when no public one is set", async () => {
    const url = new URL(await createS3Storage({ ...ENV, S3_PUBLIC_ENDPOINT: undefined }).presignDownload(KEY, 60));

    expect(url.origin).toBe("http://storage:8333");
  });

  it("reports whether a file arrived", async () => {
    const send = vi.spyOn(S3Client.prototype, "send");
    send.mockResolvedValueOnce({} as never);
    send.mockRejectedValueOnce(new NotFound({ message: "missing", $metadata: {} }));
    const storage = createS3Storage(ENV);

    expect(await storage.exists(KEY)).toBe(true);
    expect(await storage.exists(KEY)).toBe(false);
  });

  it("rethrows storage failures other than a missing file", async () => {
    vi.spyOn(S3Client.prototype, "send").mockRejectedValueOnce(new Error("access denied") as never);

    await expect(createS3Storage(ENV).exists(KEY)).rejects.toThrow("access denied");
  });
});
