import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PreserveMap } from "./PreserveMap";
import { defaultProtections } from "@/lib/contract";

describe("PreserveMap", () => {
  it("clears and restores serialized preserve zones", async () => {
    const onZonesChange = vi.fn();
    const { rerender } = render(
      <PreserveMap imageUrl="/demo/source-shopper.png" protections={defaultProtections} onZonesChange={onZonesChange} presetRequest={0} />,
    );

    await waitFor(() => expect(onZonesChange).toHaveBeenLastCalledWith([expect.objectContaining({ critical: true })]));
    fireEvent.click(screen.getByRole("button", { name: "Clear custom zones" }));
    await waitFor(() => expect(onZonesChange).toHaveBeenLastCalledWith([]));

    rerender(<PreserveMap imageUrl="/demo/source-shopper.png" protections={defaultProtections} onZonesChange={onZonesChange} presetRequest={1} />);
    await waitFor(() => expect(onZonesChange).toHaveBeenLastCalledWith([expect.objectContaining({ label: "Primary preserve zone" })]));
  });

  it("switches between brush and eraser tools", () => {
    render(<PreserveMap imageUrl="/demo/source-shopper.png" protections={defaultProtections} onZonesChange={() => undefined} presetRequest={0} />);
    const brush = screen.getByRole("button", { name: "Brush preserve zone" });
    const eraser = screen.getByRole("button", { name: "Erase preserve zone" });
    expect(brush).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(eraser);
    expect(eraser).toHaveAttribute("aria-pressed", "true");
    expect(brush).toHaveAttribute("aria-pressed", "false");
  });
});
