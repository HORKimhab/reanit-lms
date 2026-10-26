import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PaymentQrState } from "@/app/[locale]/dashboard/settings/actions";
import { onApi, requestTo } from "@/test/api";
import { renderWithIntl } from "@/test/render";

import { PaymentQrForm, type PaymentQrActions } from "./payment-qr-form";

const PNG = new File([new Uint8Array([1, 2, 3])], "qr.png", { type: "image/png" });
const QR_KEY = "schools/s/payment-qr/a.png";
const UPLOAD_URL = "https://storage.test/schools/s/payment-qr/a.png?signed";

/**
 * Builds actions that presign the image and save with the given result.
 *
 * @param result - What saving returns.
 * @returns Spies for each action.
 */
function actions(result: PaymentQrState = { status: "saved" }) {
  return {
    save: vi.fn<PaymentQrActions["save"]>().mockResolvedValue(result),
    startUpload: vi.fn<PaymentQrActions["startUpload"]>().mockResolvedValue({ status: "ready", url: UPLOAD_URL, headers: { "content-type": "image/png" }, key: QR_KEY }),
  };
}

describe("PaymentQrForm", () => {
  it("uploads a new QR straight to storage, then saves its key", async () => {
    const user = userEvent.setup();
    const spies = actions();
    onApi("PUT /schools/s/payment-qr/a.png", new Response(null, { status: 200 }));
    renderWithIntl(<PaymentQrForm qrUrl={null} actions={spies} />);
    expect(await screen.findByText(/No payment QR yet/)).toBeInTheDocument();

    await user.upload(screen.getByLabelText("QR image"), PNG);
    await user.click(screen.getByRole("button", { name: "Save payment QR" }));

    expect(await screen.findByText("Payment QR saved")).toBeInTheDocument();
    expect(requestTo("PUT /schools/s/payment-qr/a.png")).toBeDefined();
    expect((spies.save.mock.calls[0]?.[1] as FormData).get("paymentQrKey")).toBe(QR_KEY);
    expect(screen.getByRole("img", { name: "Your payment QR" })).toBeInTheDocument();
  });

  it("removes the saved QR without uploading anything", async () => {
    const user = userEvent.setup();
    const spies = actions();
    renderWithIntl(<PaymentQrForm qrUrl="https://storage.test/qr.png" actions={spies} />);

    await user.click(await screen.findByRole("button", { name: "Remove" }));

    expect(spies.startUpload).not.toHaveBeenCalled();
    expect((spies.save.mock.calls[0]?.[1] as FormData).get("intent")).toBe("remove");
  });

  it("refuses a file that is not an allowed image, without asking the server", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const spies = actions();
    renderWithIntl(<PaymentQrForm qrUrl={null} actions={spies} />);

    await user.upload(await screen.findByLabelText("QR image"), new File(["x"], "qr.svg", { type: "image/svg+xml" }));

    expect(screen.getByLabelText("QR image")).toHaveAccessibleDescription(/Choose a PNG, JPEG or WebP image/);
    expect(spies.startUpload).not.toHaveBeenCalled();
  });

  it("is written in Khmer for km", async () => {
    renderWithIntl(<PaymentQrForm qrUrl={null} actions={actions()} />, { locale: "km" });

    expect(await screen.findByRole("region", { name: "QR ទូទាត់" })).toBeInTheDocument();
  });
});
