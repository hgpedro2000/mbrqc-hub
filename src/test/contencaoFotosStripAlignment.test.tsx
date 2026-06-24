import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// ---- Mocks ----
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl: vi
          .fn()
          .mockResolvedValue({ data: { signedUrl: "https://example.com/x.jpg" } }),
      }),
    },
  },
}));

vi.mock("@/components/contencao/FotoLightbox", () => ({
  default: () => null,
}));

import ContencaoFotosStrip from "@/components/contencao/ContencaoFotosStrip";

const SIZES: Array<"sm" | "md" | "lg"> = ["sm", "md", "lg"];
const VIEWPORTS = [
  { name: "mobile", width: 375 },
  { name: "tablet", width: 768 },
  { name: "desktop", width: 1280 },
];

const setViewport = (w: number) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: w });
  window.dispatchEvent(new Event("resize"));
};

/**
 * Find the label element (block container) and the grid element (sibling).
 * Component layout:
 *   <div class="min-w-0 space-y-1.5 relative">
 *     <div ref=label class="block w-full text-center ..."> ... text ... </div>
 *     <div ref=grid  class="grid grid-cols-3 ...">         ... photos ... </div>
 *   </div>
 */
const findPair = (labelText: RegExp) => {
  const span = screen.getByText(labelText);
  // inline-flex span -> parent label div
  const label = span.closest("div") as HTMLDivElement;
  const section = label.parentElement as HTMLDivElement;
  const grid = section.querySelector(":scope > div.flex") as HTMLDivElement;
  return { label, grid, section };
};

describe("ContencaoFotosStrip — header alignment", () => {
  beforeEach(() => vi.clearAllMocks());

  for (const size of SIZES) {
    for (const vp of VIEWPORTS) {
      it(`keeps Defeito and Mark Check labels structurally centered (size=${size}, ${vp.name} ${vp.width}px)`, async () => {
        setViewport(vp.width);
        render(
          <ContencaoFotosStrip
            fotosProblema={["a.jpg", "b.jpg"]}
            fotosMarkCheck={["c.jpg"]}
            size={size}
          />
        );

        await waitFor(() => screen.getByText(/Defeito/i));
        await waitFor(() => screen.getByText(/Mark Check/i));

        for (const labelRe of [/Defeito/i, /Mark Check/i]) {
          const { label, grid, section } = findPair(labelRe);

          // Both elements must exist and live inside the same section column.
          expect(label).toBeTruthy();
          expect(grid).toBeTruthy();
          expect(label.parentElement).toBe(section);
          expect(grid.parentElement).toBe(section);

          // Label spans full width and is centered — the geometric guarantee
          // that its bounding box matches the grid's (both stretch to the
          // column width inherited from the responsive parent grid).
          expect(label.className).toMatch(/\bblock\b/);
          expect(label.className).toMatch(/\bw-full\b/);
          expect(label.className).toMatch(/\btext-center\b/);

          // Grid is a flex row centered horizontally so 1-3 photos remain centered.
          expect(grid.className).toMatch(/\bflex\b/);
          expect(grid.className).toMatch(/\bjustify-center\b/);
        }
      });
    }
  }

  it("applies the responsive height tokens for each photoSize", async () => {
    const expectations: Record<"sm" | "md" | "lg", RegExp> = {
      sm: /\bh-14\b.*\bsm:h-16\b/,
      md: /\bh-20\b.*\bsm:h-24\b/,
      lg: /\bh-24\b.*\bsm:h-28\b.*\bmd:h-32\b/,
    };
    for (const size of SIZES) {
      const { unmount } = render(
        <ContencaoFotosStrip
          fotosProblema={["a.jpg"]}
          fotosMarkCheck={["b.jpg"]}
          size={size}
        />
      );
      await waitFor(() => screen.getByText(/Defeito/i));
      const { grid } = findPair(/Defeito/i);
      const cell = grid.querySelector("button, div[class*='border-dashed']") as HTMLElement;
      expect(cell.className).toMatch(expectations[size]);
      unmount();
    }
  });

  it("outer grid is responsive (1 col mobile, 2 cols ≥sm) so columns stay symmetric", async () => {
    render(
      <ContencaoFotosStrip
        fotosProblema={["a.jpg"]}
        fotosMarkCheck={["b.jpg"]}
        size="md"
      />
    );
    await waitFor(() => screen.getByText(/Defeito/i));
    const { section } = findPair(/Defeito/i);
    const outer = section.parentElement as HTMLElement;
    expect(outer.className).toMatch(/\bgrid-cols-1\b/);
    expect(outer.className).toMatch(/\bsm:grid-cols-2\b/);
  });

  it("debug mode reports Δ≈0px when label and grid share identical bounding rects", async () => {
    // Force every element's bounding rect to a fixed column box, simulating
    // both label and grid stretching to the same parent column width.
    const rect = { left: 100, top: 0, right: 460, bottom: 200, width: 360, height: 200, x: 100, y: 0, toJSON: () => ({}) } as DOMRect;
    const spy = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockReturnValue(rect);

    render(
      <ContencaoFotosStrip
        fotosProblema={["a.jpg"]}
        fotosMarkCheck={["b.jpg"]}
        size="lg"
        debug
      />
    );

    await waitFor(() => {
      const deltas = screen.getAllByText(/Δ-?\d+px/);
      expect(deltas.length).toBeGreaterThanOrEqual(2);
      for (const d of deltas) {
        const n = Number(d.textContent!.replace(/[^\d-]/g, ""));
        expect(Math.abs(n)).toBeLessThanOrEqual(1);
      }
    });

    spy.mockRestore();
  });
});
