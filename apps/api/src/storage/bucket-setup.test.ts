import { CreateBucketCommand, HeadBucketCommand, NotFound, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { setUpBucket } from "./bucket-setup";

/**
 * Creates a client whose calls are recorded; HeadBucket fails with the given error.
 *
 * @param headError What HeadBucket throws, or undefined when the bucket exists.
 * @returns The client and the commands it was sent.
 */
function recordingClient(headError?: Error) {
  const client = new S3Client({ region: "auto" });
  const sent: unknown[] = [];
  vi.spyOn(client, "send").mockImplementation(async (command: unknown) => {
    sent.push(command);
    if (command instanceof HeadBucketCommand && headError) throw headError;
    return {};
  });
  return { client, sent };
}

describe("setUpBucket", () => {
  it("creates a missing bucket and allows the origins to upload and play", async () => {
    const { client, sent } = recordingClient(new NotFound({ message: "missing", $metadata: {} }));

    expect(await setUpBucket(client, "media", ["http://localhost:3000"])).toEqual({ isCreated: true });

    expect(sent.find((c) => c instanceof CreateBucketCommand)).toBeDefined();
    const cors = sent.find((c): c is PutBucketCorsCommand => c instanceof PutBucketCorsCommand);
    expect(cors?.input.CORSConfiguration?.CORSRules).toEqual([
      expect.objectContaining({ AllowedOrigins: ["http://localhost:3000"], AllowedMethods: ["PUT", "GET"], AllowedHeaders: ["content-type"] }),
    ]);
  });

  it("only updates CORS when the bucket exists", async () => {
    const { client, sent } = recordingClient();

    expect(await setUpBucket(client, "media", ["https://reanit.com"])).toEqual({ isCreated: false });
    expect(sent.some((c) => c instanceof CreateBucketCommand)).toBe(false);
    expect(sent.some((c) => c instanceof PutBucketCorsCommand)).toBe(true);
  });

  it("rethrows other storage errors", async () => {
    const { client } = recordingClient(new Error("access denied"));

    await expect(setUpBucket(client, "media", [])).rejects.toThrow("access denied");
  });
});
