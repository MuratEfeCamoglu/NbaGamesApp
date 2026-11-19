// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnswerGrid, AnswerOption } from "./answer-option";

const OPTIONS = [
  { id: "p1", label: "Andrew Bogut" },
  { id: "p2", label: "Andre Iguodala" },
  { id: "p3", label: "Festus Ezeli" },
  { id: "p4", label: "David Lee" },
];

afterEach(cleanup);

function stateOf(label: string) {
  return screen.getByRole("button", { name: new RegExp(label) }).getAttribute("data-state");
}

describe("AnswerOption", () => {
  it.each(["default", "selected", "correct", "wrong", "disabled"] as const)(
    "renders the %s state with its shortcut number",
    (state) => {
      render(<AnswerOption shortcut={3} label="Kobe Bryant" state={state} onSelect={() => {}} />);
      const btn = screen.getByRole("button", { name: /Kobe Bryant/ });
      expect(btn).toHaveAttribute("data-component", "AnswerOption");
      expect(btn).toHaveAttribute("data-state", state);
      expect(btn).toHaveTextContent("3");
      if (state === "disabled") expect(btn).toBeDisabled();
      else expect(btn).toBeEnabled();
    },
  );
});

describe("AnswerGrid", () => {
  it("answers immediately on click", () => {
    const onAnswer = vi.fn();
    render(<AnswerGrid options={OPTIONS} onAnswer={onAnswer} reveal={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Festus Ezeli/ }));
    expect(onAnswer).toHaveBeenCalledWith("p3");
  });

  it("selects with number keys and confirms with Enter", () => {
    const onAnswer = vi.fn();
    render(<AnswerGrid options={OPTIONS} onAnswer={onAnswer} reveal={null} />);
    fireEvent.keyDown(document, { key: "2" });
    expect(stateOf("Andre Iguodala")).toBe("selected");
    expect(onAnswer).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "4" });
    expect(stateOf("Andre Iguodala")).toBe("default");
    expect(stateOf("David Lee")).toBe("selected");
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith("p4");
  });

  it("ignores keys outside the option range and while typing in an input", () => {
    const onAnswer = vi.fn();
    render(
      <>
        <input aria-label="other" />
        <AnswerGrid options={OPTIONS} onAnswer={onAnswer} reveal={null} />
      </>,
    );
    fireEvent.keyDown(document, { key: "5" });
    fireEvent.keyDown(screen.getByLabelText("other"), { key: "1" });
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onAnswer).not.toHaveBeenCalled();
    expect(stateOf("Andrew Bogut")).toBe("default");
  });

  it("shows correct / wrong / disabled after the reveal and locks input", () => {
    const onAnswer = vi.fn();
    render(
      <AnswerGrid
        options={OPTIONS}
        onAnswer={onAnswer}
        reveal={{ chosenId: "p2", correctId: "p1" }}
      />,
    );
    expect(stateOf("Andrew Bogut")).toBe("correct");
    expect(stateOf("Andre Iguodala")).toBe("wrong");
    expect(stateOf("Festus Ezeli")).toBe("disabled");
    fireEvent.keyDown(document, { key: "1" });
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onAnswer).not.toHaveBeenCalled();
    for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
  });
});
