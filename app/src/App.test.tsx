import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { APP_ROOT_FOLDER_NAME } from "./config";

describe("App shell", () => {
  it("renders sidebar and editor with initial file", async () => {
    render(<App />);
    expect(await screen.findByText("Files")).toBeInTheDocument();
    const occurrences = await screen.findAllByText(new RegExp(APP_ROOT_FOLDER_NAME, "i"));
    expect(occurrences.length).toBeGreaterThan(0);
  });

  it("opens command palette via Ctrl+K", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.keyboard("{Control>}k");
    const inputs = await screen.findAllByPlaceholderText(/Search files/);
    expect(inputs.length).toBeGreaterThan(0);
  });
});
