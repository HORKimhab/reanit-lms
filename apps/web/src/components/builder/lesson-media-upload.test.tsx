import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { onApi, problem, requestTo } from "@/test/api";
import { renderWithIntl } from "@/test/render";

import { LessonMediaUpload, type LessonMediaActions } from "./lesson-media-upload";

const VIDEO = new File(["video bytes"], "intro.mp4", { type: "video/mp4" });
const UPLOAD_URL = "https://storage.test/schools/s/lessons/l/f.mp4?signed";
const STORAGE_ROUTE = "PUT /schools/s/lessons/l/f.mp4";

/**
 * Builds actions that save, presign and attach successfully.
 *
 * @returns Spies for each action.
 */
function okActions() {
  return {
    saveNow: vi.fn<LessonMediaActions["saveNow"]>().mockResolvedValue(undefined),
    start: vi
      .fn<LessonMediaActions["start"]>()
      .mockResolvedValue({ status: "ready", url: UPLOAD_URL, headers: { "content-type": "video/mp4" }, key: "k" }),
    attach: vi.fn<LessonMediaActions["attach"]>().mockResolvedValue({ status: "attached" }),
  };
}

/**
 * Renders the control for a video lesson and picks `VIDEO`.
 *
 * @param actions - The upload actions.
 * @param hasMedia - Whether the lesson already has a file.
 * @returns When the file has been picked.
 */
async function pickVideo(actions: LessonMediaActions, hasMedia = false) {
  const user = userEvent.setup();
  renderWithIntl(<LessonMediaUpload lessonId="l1" lessonType="video" lessonTitle="Intro" hasMedia={hasMedia} actions={actions} />);
  await user.upload(await screen.findByLabelText(hasMedia ? "Replace video of Intro" : "Upload video for Intro"), VIDEO);
}

describe("LessonMediaUpload", () => {
  it("saves, uploads the file straight to storage and attaches it", async () => {
    const actions = okActions();
    onApi(STORAGE_ROUTE, new Response(null, { status: 200 }));

    await pickVideo(actions);

    expect(await screen.findByText("File attached")).toHaveAttribute("role", "status");
    expect(actions.saveNow.mock.invocationCallOrder[0]).toBeLessThan(actions.start.mock.invocationCallOrder[0] ?? 0);
    expect(actions.start).toHaveBeenCalledWith("l1", { contentType: "video/mp4", sizeBytes: VIDEO.size });
    const stored = requestTo(STORAGE_ROUTE);
    expect(stored?.headers.get("content-type")).toBe("video/mp4");
    expect(await stored?.text()).toBe("video bytes");
    expect(actions.attach).toHaveBeenCalledWith("l1", "k");
    expect(screen.getByLabelText("Replace video of Intro")).toBeInTheDocument();
  });

  it.each([
    ["tooLarge", "This file is too large."],
    ["unsupported", "This file type does not fit this lesson."],
    ["notSaved", "Wait for the lesson to save, then try again."],
  ] as const)("explains a %s refusal without uploading", async (status, message) => {
    const actions = { ...okActions(), start: vi.fn<LessonMediaActions["start"]>().mockResolvedValue({ status }) };

    await pickVideo(actions);

    expect(await screen.findByText(message)).toHaveAttribute("role", "status");
    expect(requestTo(STORAGE_ROUTE)).toBeUndefined();
    expect(actions.attach).not.toHaveBeenCalled();
  });

  it("reports a failed upload without attaching", async () => {
    const actions = okActions();
    onApi(STORAGE_ROUTE, problem(403));

    await pickVideo(actions);

    expect(await screen.findByText("Upload failed. Try again.")).toHaveAttribute("role", "status");
    expect(actions.attach).not.toHaveBeenCalled();
  });

  it("reports a failure when storage does not have the file at attach time", async () => {
    const actions = { ...okActions(), attach: vi.fn<LessonMediaActions["attach"]>().mockResolvedValue({ status: "notUploaded" }) };
    onApi(STORAGE_ROUTE, new Response(null, { status: 200 }));

    await pickVideo(actions);

    expect(await screen.findByText("Upload failed. Try again.")).toHaveAttribute("role", "status");
  });

  it("offers only PDFs for a PDF lesson", async () => {
    renderWithIntl(<LessonMediaUpload lessonId="l1" lessonType="pdf" lessonTitle="Workbook" hasMedia={false} actions={okActions()} />);

    expect(await screen.findByLabelText("Upload PDF for Workbook")).toHaveAttribute("accept", "application/pdf");
  });
});
