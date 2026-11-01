import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EvidencePackage } from "./EvidencePackage";
import { examples } from "@/lib/asshown/examples";
vi.mock("@/lib/asshown/client-image", () => ({
  readImage: vi.fn(async () => "data:image/png;base64,YQ=="),
}));
describe("evidence package review", () => {
  it("defaults attachments to excluded and resets review after edits", async () => {
    render(<EvidencePackage product={examples()[0]} />);
    const exportButton = screen.getByRole("button", {
      name: /Download evidence package/,
    });
    expect(exportButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Add JPEG/), {
      target: {
        files: [new File(["test"], "delivery.png", { type: "image/png" })],
      },
    });
    const include = await screen.findByRole("checkbox", {
      name: /Include this attachment/,
    });
    expect(include).not.toBeChecked();
    fireEvent.click(include);
    fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed/ }));
    expect(exportButton).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Editable seller message"), {
      target: { value: "New observation" },
    });
    expect(exportButton).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove delivery.png" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("checkbox", { name: /Include this attachment/ }),
      ).not.toBeInTheDocument(),
    );
  });
});
