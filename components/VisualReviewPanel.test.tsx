import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { VisualReviewPanel } from "./VisualReviewPanel";
vi.mock("@/lib/asshown/client-image", () => ({
  dataImageFile: () =>
    new File(["fixture"], "product.png", { type: "image/png" }),
  processingImage: async (file: File) => file,
}));
afterEach(() => vi.unstubAllGlobals());
it("requires explicit human review and clears it when images or notes change", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/vision"))
        return {
          ok: true,
          json: async () => ({
            observations: [
              {
                attribute: "sleeves",
                status: "manual review required",
                possibleDifference: true,
                sourceDescription: "Long sleeves",
                resultDescription: "Long sleeves",
                sourceRegion: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
                resultRegion: { x: 0.2, y: 0.2, width: 0.3, height: 0.4 },
                limitation: "Check the visible cuff.",
              },
            ],
            limitation: "Suggestions only.",
          }),
        };
      return {
        ok: true,
        headers: new Headers({ "content-type": "image/png" }),
        blob: async () => new Blob(["fixture"], { type: "image/png" }),
      };
    }),
  );
  const { rerender } = render(
    <VisualReviewPanel
      source="data:image/png;base64,ZmFrZQ=="
      initialResult="/before.png"
      kind="preview"
    />,
  );
  const exportButton = screen.getByRole("button", {
    name: "Export reviewed observations",
  });
  expect(exportButton).toBeDisabled();
  fireEvent.click(
    screen.getByLabelText(
      "Send these two images to OpenAI for garment review.",
    ),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "Suggest visible garment observations",
    }),
  );
  await screen.findByText("Possible difference — review visually");
  expect(
    vi
      .mocked(fetch)
      .mock.calls.some(([url]) => String(url).startsWith("data:")),
  ).toBe(false);
  expect(exportButton).toBeDisabled();
  expect(
    screen.getByRole("link", {
      name: "Open full-size generated preview for comparison",
    }),
  ).toHaveAttribute("href", "/before.png");
  expect(screen.queryByText(/Source region:/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/I reviewed these observations/));
  expect(exportButton).toBeEnabled();
  fireEvent.change(
    screen.getByLabelText("Your corrections or manual observations"),
    { target: { value: "Cuff needs checking." } },
  );
  expect(exportButton).toBeDisabled();
  rerender(
    <VisualReviewPanel
      source="data:image/png;base64,ZmFrZQ=="
      initialResult="/repaired.png"
      kind="preview"
    />,
  );
  await waitFor(() =>
    expect(
      screen.queryByText("Possible difference — review visually"),
    ).not.toBeInTheDocument(),
  );
  expect(
    screen.getByRole("img", { name: "Generated preview for comparison" }),
  ).toHaveAttribute("src", "/repaired.png");
  expect(screen.getByLabelText(/Send these two images/)).not.toBeChecked();
  expect(
    screen.getByRole("button", { name: "Export reviewed observations" }),
  ).toBeDisabled();
});
