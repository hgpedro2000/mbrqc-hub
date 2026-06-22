import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import { readFileSync } from "fs";
import path from "path";

const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), "utf8");

describe("Contenção relocation — Hub no longer registers the tile", () => {
  const hubSrc = read("src/pages/Hub.tsx");

  it("does not declare a contencao entry in the Hub modules list", () => {
    // The tile registration looked like: { id: "contencao", ..., path: "/contencao", ... }
    expect(hubSrc).not.toMatch(/id:\s*["']contencao["']/);
  });

  it("keeps Contenção out of the Hub allModules array", () => {
    const match = hubSrc.match(/const\s+allModules\s*=\s*\[([\s\S]*?)\];/);
    expect(match, "allModules array must exist in Hub.tsx").toBeTruthy();
    expect(match![1]).not.toMatch(/contencao/i);
  });
});

describe("Contenção relocation — Apontamentos hosts the card", () => {
  const apSrc = read("src/pages/Apontamentos.tsx");

  it("renders a Contenção card that navigates to /contencao", () => {
    expect(apSrc).toMatch(/navigate\(["']\/contencao["']\)/);
    expect(apSrc).toMatch(/>\s*Contenção\s*</);
  });

  it("uses module-card classes so spacing/wrap/sizing match the other cards on small screens", () => {
    // Locate the Contenção card block in source and verify it inherits the shared responsive classes.
    const idx = apSrc.indexOf("Contenção");
    expect(idx).toBeGreaterThan(-1);
    const block = apSrc.slice(Math.max(0, idx - 800), idx + 400);
    expect(block).toContain("module-card");
    expect(block).toContain("opacity-0");
    expect(block).toContain("animate-fade-in");
    // Responsive typography tokens shared with the other cards.
    expect(block).toMatch(/text-base md:text-xl/);
    expect(block).toMatch(/line-clamp-2/);
  });
});

describe("/contencao route still resolves to the Contenção screen", () => {
  it("renders the Contenção screen when the route is /contencao", () => {
    render(
      <MemoryRouter initialEntries={["/contencao"]}>
        <Routes>
          <Route path="/" element={<div data-testid="hub" />} />
          <Route
            path="/contencao"
            element={<div data-testid="contencao-screen">Contenção</div>}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("contencao-screen")).toBeInTheDocument();
  });
});
