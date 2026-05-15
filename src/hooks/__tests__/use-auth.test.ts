import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "../use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

describe("useAuth — signIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("isLoading is false initially", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("sets isLoading true during signIn and false after", async () => {
    let resolve!: (val: any) => void;
    vi.mocked(signInAction).mockReturnValue(new Promise((res) => { resolve = res; }) as any);
    vi.mocked(getAnonWorkData).mockReturnValue(null);
    vi.mocked(getProjects).mockResolvedValue([]);
    vi.mocked(createProject).mockResolvedValue({ id: "p1" } as any);

    const { result } = renderHook(() => useAuth());

    let promise: Promise<any>;
    act(() => { promise = result.current.signIn("a@b.com", "pass"); });

    expect(result.current.isLoading).toBe(true);

    await act(async () => { resolve({ success: false }); await promise!; });

    expect(result.current.isLoading).toBe(false);
  });

  test("returns the result from signInAction", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());
    let returnValue: any;
    await act(async () => { returnValue = await result.current.signIn("a@b.com", "wrong"); });

    expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
  });

  test("resets isLoading to false even if signInAction throws", async () => {
    vi.mocked(signInAction).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass").catch(() => {}); });

    expect(result.current.isLoading).toBe(false);
  });

  test("does not navigate on failed signIn", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "wrong"); });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test("navigates to existing project on successful signIn", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: true });
    vi.mocked(getAnonWorkData).mockReturnValue(null);
    vi.mocked(getProjects).mockResolvedValue([{ id: "proj-1" }] as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    expect(mockPush).toHaveBeenCalledWith("/proj-1");
  });

  test("creates a new project and navigates when user has no projects", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: true });
    vi.mocked(getAnonWorkData).mockReturnValue(null);
    vi.mocked(getProjects).mockResolvedValue([]);
    vi.mocked(createProject).mockResolvedValue({ id: "new-proj" } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    expect(createProject).toHaveBeenCalledWith(expect.objectContaining({ messages: [], data: {} }));
    expect(mockPush).toHaveBeenCalledWith("/new-proj");
  });

  test("migrates anon work into a project and navigates to it on successful signIn", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: true });
    vi.mocked(getAnonWorkData).mockReturnValue({
      messages: [{ role: "user", content: "hello" }],
      fileSystemData: { "/App.jsx": { type: "file", content: "" } },
    });
    vi.mocked(createProject).mockResolvedValue({ id: "anon-proj" } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "hello" }],
        data: { "/App.jsx": { type: "file", content: "" } },
      })
    );
    expect(clearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/anon-proj");
    expect(getProjects).not.toHaveBeenCalled();
  });
});
