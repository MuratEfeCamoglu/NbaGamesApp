// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Era } from "@/games/core/types";
import {
  ERA_STORAGE_KEY,
  getRememberedEra,
  resetEraMemory,
  useEraPreference,
} from "@/lib/use-era-preference";
import { EraBadge, EraSwitch } from "./era-switch";

const radio = (name: "Current" | "Retired") => screen.getByRole("radio", { name });

function Controlled({ onChange }: { onChange: (era: Era) => void }) {
  const [era, setEra] = useState<Era>("current");
  return (
    <EraSwitch
      legend="Pick your era"
      value={era}
      onChange={(e) => {
        setEra(e);
        onChange(e);
      }}
    />
  );
}

/** Two independent consumers of the remembered era, like the Home hero and a featured card. */
function Remembered() {
  const [era, setEra] = useEraPreference();
  return (
    <>
      <EraSwitch value={era} onChange={setEra} />
      <output data-testid="elsewhere">{era}</output>
    </>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  resetEraMemory();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("EraSwitch", () => {
  it("is a labelled radio group with both eras and their taglines", () => {
    render(<Controlled onChange={() => {}} />);
    const group = screen.getByRole("group", { name: "Pick your era" });
    expect(group).toHaveAttribute("data-component", "EraSwitch");
    expect(group).toHaveAttribute("data-value", "current");
    expect(radio("Current")).toBeChecked();
    expect(radio("Current")).toHaveAccessibleDescription("Active players · today's teams");
    expect(radio("Retired")).not.toBeChecked();
    expect(radio("Retired")).toHaveAccessibleDescription("Retired legends · classic teams");
  });

  it("selects an era by clicking anywhere on its side", () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    fireEvent.click(screen.getByText("Retired legends · classic teams"));
    expect(onChange).toHaveBeenLastCalledWith("retired");
    expect(radio("Retired")).toBeChecked();
    expect(screen.getByRole("group")).toHaveAttribute("data-value", "retired");
  });

  it("moves the choice with the arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    act(() => radio("Current").focus());
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("retired");
    expect(radio("Retired")).toBeChecked();
    expect(radio("Retired")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith("current");
    expect(radio("Current")).toBeChecked();
  });
});

describe("remembered era (localStorage)", () => {
  it("defaults to Current, remembers a choice and restores it on the next visit", () => {
    const first = render(<Remembered />);
    expect(radio("Current")).toBeChecked();
    fireEvent.click(radio("Retired"));
    expect(window.localStorage.getItem(ERA_STORAGE_KEY)).toBe("retired");
    expect(screen.getByTestId("elsewhere")).toHaveTextContent("retired");
    first.unmount();

    resetEraMemory(); // a new page load only has storage
    render(<Remembered />);
    expect(radio("Retired")).toBeChecked();
  });

  it("ignores junk in storage", () => {
    window.localStorage.setItem(ERA_STORAGE_KEY, "golden-age");
    render(<Remembered />);
    expect(radio("Current")).toBeChecked();
  });

  it("still works for the page session when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    render(<Remembered />);
    expect(radio("Current")).toBeChecked();
    fireEvent.click(radio("Retired"));
    expect(radio("Retired")).toBeChecked();
    expect(screen.getByTestId("elsewhere")).toHaveTextContent("retired");
    expect(getRememberedEra()).toBe("retired");
  });

  it("follows a choice made in another tab", () => {
    render(<Remembered />);
    act(() => {
      window.localStorage.setItem(ERA_STORAGE_KEY, "retired");
      window.dispatchEvent(
        new StorageEvent("storage", { key: ERA_STORAGE_KEY, newValue: "retired" }),
      );
    });
    expect(radio("Retired")).toBeChecked();
  });
});

describe("EraBadge", () => {
  it("names the era, shows Daily / unfiltered sessions as Mixed and skips a missing era", () => {
    const { container } = render(
      <>
        <EraBadge era="current" />
        <EraBadge era="retired" />
        <EraBadge era="all" />
        <EraBadge era={undefined} />
      </>,
    );
    const badges = container.querySelectorAll("[data-component='EraBadge']");
    expect(badges).toHaveLength(3);
    expect([...badges].map((b) => b.getAttribute("data-variant"))).toEqual([
      "current",
      "retired",
      "mixed",
    ]);
    expect(badges[1]).toHaveTextContent("Era: Retired");
    expect(badges[2]).toHaveTextContent("Mixed");
  });
});
