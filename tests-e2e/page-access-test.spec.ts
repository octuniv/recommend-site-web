import { test, expect } from "@playwright/test";
import { login, logout } from "./authUtil";

test.describe("Page-to-page movement test", () => {
  test.beforeEach(async ({ page }) => {
    await logout(page);
    await page.goto("/");
  });

  test.afterAll(async ({ page }) => {
    try {
      await login(page); // 로그인 상태로 초기화
    } catch (error) {
      console.error("Failed to log in after test:", error);
    }
  });

  test("Main Page Access test", async ({ page }) => {
    await expect(page.getByRole("paragraph")).toContainText("Welcome My Home!");
  });

  test("Login Page Access Test", async ({ page }) => {
    await page.getByRole("link", { name: "Login" }).click();
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
    await expect(page.getByText("Email")).toBeVisible();
    await expect(page.getByText("Password")).toBeVisible();
    await page.getByRole("link", { name: "MyApp" }).click();
    await expect(page).not.toHaveURL("/login");
  });

  test("SignUp Page Access Test", async ({ page }) => {
    await page.getByRole("link", { name: "SignUp" }).click();
    await expect(page).toHaveURL("/signup");
    await expect(page.getByRole("button", { name: "Sign Up" })).toBeVisible();
    await page.getByRole("link", { name: "MyApp" }).click();
    await expect(page).not.toHaveURL("/signup");
  });

  test("Dashboard Page Can't Access Test (if you don't login)", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login");
  });
});
