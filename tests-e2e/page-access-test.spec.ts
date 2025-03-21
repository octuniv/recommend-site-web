import { test, expect } from "@playwright/test";

test.describe("Page-to-page movement test", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/");
    await page.reload();
  });

  test("Main Page Access test", async ({ page }) => {
    await expect(page.getByRole("paragraph")).toContainText("Welcome My Home!");
  });

  test("Login Page Access Test", async ({ page }) => {
    await page.getByLabel("Login").click();
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
    await expect(page.getByText("Email")).toBeVisible();
    await expect(page.getByText("Password")).toBeVisible();
    await expect(page.getByRole("link", { name: "Signup" })).toBeVisible();
    await page.getByLabel("Go To Home").click();
    await expect(page).not.toHaveURL("/login");
  });

  test("SignUp Page Access Test", async ({ page }) => {
    await page.getByLabel("Login").click();
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("link", { name: "Signup" })).toBeVisible();
    await page.getByRole("link", { name: "Signup" }).click();
    await expect(page).toHaveURL("/signup");
    await page.getByLabel("Go To Home").click();
    await expect(page).not.toHaveURL("/signup");
  });

  test("Dashboard Page Can't Access Test (if you don't login)", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login");
  });

  test("Posts Page Access Test", async ({ page }) => {
    await page.getByRole("button", { name: "Sidebar Activation" }).click();
    await expect(page.getByRole("link", { name: "posts" })).toBeVisible();
    await page.getByRole("link", { name: "posts" }).click();
    await expect(page).toHaveURL("/posts");
  });

  test("Redirect to login page when ths user is not logged in and access page about creating post", async ({
    page,
  }) => {
    await page.goto("/posts/create");
    await expect(page).toHaveURL("/login");
  });

  test.describe("Settings Page can't access (if you don't login)", () => {
    test("'/settings' page can't access", async ({ page }) => {
      await page.goto("/settings");
      await expect(page).toHaveURL("/");
    });
    test("'/settings/nickname' page can't access", async ({ page }) => {
      await page.goto("/settings/nickname");
      await expect(page).toHaveURL("/");
    });
    test("'/settings/password' page can't access", async ({ page }) => {
      await page.goto("/settings/password");
      await expect(page).toHaveURL("/");
    });
  });
});
