import { test, expect, type APIRequestContext } from "@playwright/test";
import { PrismaClient, StudioRole } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import {
  accountDeactivateError,
  accountMutationError,
  canAssignRole,
} from "./lib/account-admin";

const db = new PrismaClient();
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:3183";
const prefix = "ci-account-admin-";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}

function emailFor(label: string) {
  return prefix + label + "-" + randomBytes(4).toString("hex") + "@example.invalid";
}

test.describe("account admin policy", () => {
  const sa = { id: "sa-1", role: "SUPERADMIN" as const };
  const admin = { id: "admin-1", role: "ADMIN" as const };
  const editor = { id: "ed-1", role: "EDITOR" as const, active: true };

  test("only a superadmin may assign or remove the superadmin role", () => {
    expect(canAssignRole("SUPERADMIN", "EDITOR", "SUPERADMIN")).toBeTruthy();
    expect(canAssignRole("SUPERADMIN", "SUPERADMIN", "ADMIN")).toBeTruthy();
    expect(canAssignRole("ADMIN", "EDITOR", "SUPERADMIN")).toBeFalsy();
    expect(canAssignRole("ADMIN", "SUPERADMIN", "ADMIN")).toBeFalsy();
    expect(canAssignRole("ADMIN", "EDITOR", "REVIEWER")).toBeTruthy();
    expect(canAssignRole("EDITOR", "EDITOR", "ADMIN")).toBeFalsy();
  });

  test("blocks last active superadmin demotion and deactivation, and self-deactivation", () => {
    const last = { id: "sa-1", role: "SUPERADMIN" as const, active: true };
    expect(accountMutationError(sa, last, { role: "ADMIN" }, 1)).toBe("Cannot demote the last active superadmin");
    expect(accountMutationError(sa, last, { active: false }, 1)).toBe("Cannot deactivate the last active superadmin");
    expect(accountDeactivateError(sa, last, 1)).toBe("Cannot deactivate the last active superadmin");
    expect(accountMutationError(sa, last, { name: "Founder" }, 1)).toBeNull();
    expect(accountMutationError(sa, last, { active: false }, 2)).toBe("Cannot deactivate your own account");
    expect(accountMutationError(sa, last, { role: "ADMIN" }, 2)).toBeNull();
    expect(accountMutationError(sa, { id: "sa-2", role: "SUPERADMIN", active: true }, { active: false }, 2)).toBeNull();
  });

  test("admin policy helper cannot grant or strip superadmin even if it can edit other roles", () => {
    expect(accountMutationError(admin, editor, { role: "REVIEWER" }, 1)).toBe("Forbidden");
    expect(canAssignRole(admin.role, editor.role, "REVIEWER")).toBeTruthy();
    expect(canAssignRole(admin.role, editor.role, "SUPERADMIN")).toBeFalsy();
  });
});

test.describe("admin users API and Manajemen Akun", () => {
  const password = "CI-account-" + randomBytes(12).toString("hex");
  const createdEmails: string[] = [];
  let superA: { id: string; email: string };
  let superB: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let editorUser: { id: string; email: string };

  async function createUser(role: StudioRole, active: boolean, label: string) {
    const email = emailFor(label);
    const user = await db.studioUser.create({
      data: {
        email,
        name: "CI " + label,
        role,
        active,
        passwordHash: active ? hashPassword(password) : undefined,
      },
    });
    createdEmails.push(email);
    return { id: user.id, email };
  }

  async function authHeaders(request: APIRequestContext, email: string) {
    const login = await request.post(origin + "/api/auth/login", { data: { email, password } });
    expect(login.ok(), await login.text()).toBeTruthy();
    const raw = (login.headers()["set-cookie"] || "").match(/bcstudio_session=([^;]+)/)?.[1];
    expect(raw).toBeTruthy();
    return { Cookie: "bcstudio_session=" + raw };
  }

  test.beforeAll(async () => {
    superA = await createUser("SUPERADMIN", true, "super-a");
    superB = await createUser("SUPERADMIN", true, "super-b");
    adminUser = await createUser("ADMIN", true, "admin");
    editorUser = await createUser("EDITOR", false, "editor-inactive");
  });

  test.afterAll(async () => {
    if (createdEmails.length) {
      await db.studioUser.deleteMany({ where: { email: { in: createdEmails } } });
    }
    await db.studioUser.deleteMany({ where: { email: { startsWith: prefix } } });
    await db.$disconnect();
  });

  test("admin and editor cannot access account management APIs", async ({ request }) => {
    const adminHeaders = await authHeaders(request, adminUser.email);
    const editorLoginEmail = emailFor("editor-active");
    await db.studioUser.create({
      data: {
        email: editorLoginEmail,
        name: "CI editor-active",
        role: "EDITOR",
        active: true,
        passwordHash: hashPassword(password),
      },
    });
    createdEmails.push(editorLoginEmail);
    const editorHeaders = await authHeaders(request, editorLoginEmail);
    for (const headers of [adminHeaders, editorHeaders]) {
      expect((await request.get(origin + "/api/admin/users", { headers })).status()).toBe(403);
      expect((await request.post(origin + "/api/admin/users", { headers, data: { name: "X", email: emailFor("blocked"), role: "EDITOR" } })).status()).toBe(403);
      expect((await request.post(origin + "/api/admin/users", { headers, data: { name: "X", email: emailFor("blocked-sa"), role: "SUPERADMIN" } })).status()).toBe(403);
    }
  });

  test("superadmin can list, invite including SUPERADMIN, edit, resend, and deactivate with guards", async ({ request }) => {
    const headers = await authHeaders(request, superA.email);

    const listed = await request.get(origin + "/api/admin/users", { headers });
    expect(listed.ok()).toBeTruthy();
    const listBody = await listed.json();
    expect(listBody.me).toEqual({ id: superA.id, role: "SUPERADMIN" });
    expect(listBody.users.some((item: { email: string }) => item.email === superB.email)).toBeTruthy();

    const inviteEditor = await request.post(origin + "/api/admin/users", {
      headers,
      data: { name: "CI invited editor", email: emailFor("invited-editor"), role: "EDITOR" },
    });
    expect(inviteEditor.status()).toBe(201);
    const invitedEditor = (await inviteEditor.json()).user;
    createdEmails.push(invitedEditor.email);
    expect(invitedEditor.role).toBe("EDITOR");
    expect(invitedEditor.active).toBeFalsy();

    const inviteSa = await request.post(origin + "/api/admin/users", {
      headers,
      data: { name: "CI invited superadmin", email: emailFor("invited-sa"), role: "SUPERADMIN" },
    });
    expect(inviteSa.status()).toBe(201);
    const invitedSa = (await inviteSa.json()).user;
    createdEmails.push(invitedSa.email);
    expect(invitedSa.role).toBe("SUPERADMIN");

    const rename = await request.patch(origin + "/api/admin/users", {
      headers,
      data: { id: superB.id, name: "CI Super B Updated" },
    });
    expect(rename.ok(), await rename.text()).toBeTruthy();
    expect((await rename.json()).user.name).toBe("CI Super B Updated");

    const selfRename = await request.patch(origin + "/api/admin/users", {
      headers,
      data: { id: superA.id, name: "CI Super A Self" },
    });
    expect(selfRename.ok()).toBeTruthy();

    expect((await request.patch(origin + "/api/admin/users", { headers, data: { id: superA.id, active: false } })).status()).toBe(403);
    expect((await request.delete(origin + "/api/admin/users?id=" + encodeURIComponent(superA.id), { headers })).status()).toBe(403);

    const deactivateB = await request.delete(origin + "/api/admin/users?id=" + encodeURIComponent(superB.id), { headers });
    expect(deactivateB.ok(), await deactivateB.text()).toBeTruthy();
    expect((await db.studioUser.findUniqueOrThrow({ where: { id: superB.id } })).active).toBeFalsy();

    expect((await request.patch(origin + "/api/admin/users", { headers, data: { id: superA.id, role: "ADMIN" } })).status()).toBe(403);
    expect((await request.delete(origin + "/api/admin/users?id=" + encodeURIComponent(superA.id), { headers })).status()).toBe(403);

    const reactivateB = await request.patch(origin + "/api/admin/users", { headers, data: { id: superB.id, active: true } });
    expect(reactivateB.ok(), await reactivateB.text()).toBeTruthy();

    const promote = await request.patch(origin + "/api/admin/users", { headers, data: { id: adminUser.id, role: "SUPERADMIN" } });
    expect(promote.ok(), await promote.text()).toBeTruthy();
    const demoteAdminBack = await request.patch(origin + "/api/admin/users", { headers, data: { id: adminUser.id, role: "ADMIN" } });
    expect(demoteAdminBack.ok()).toBeTruthy();

    const resend = await request.post(origin + "/api/admin/users", { headers, data: { id: editorUser.id, resendActivation: true } });
    expect([200, 503]).toContain(resend.status());
    if (resend.status() === 200) {
      expect((await db.studioAuthToken.count({ where: { userId: editorUser.id, purpose: "activate", usedAt: null } }))).toBeGreaterThan(0);
    }

    const alreadyActiveResend = await request.post(origin + "/api/admin/users", { headers, data: { id: superA.id, resendActivation: true } });
    expect(alreadyActiveResend.status()).toBe(400);

    const deactivateEditor = await request.delete(origin + "/api/admin/users?id=" + encodeURIComponent(invitedEditor.id), { headers });
    // invited editor is already inactive
    expect(deactivateEditor.status()).toBe(400);

    const deactivateAdmin = await request.patch(origin + "/api/admin/users", { headers, data: { id: adminUser.id, active: false } });
    expect(deactivateAdmin.ok()).toBeTruthy();
  });

  test("Manajemen Akun UI lists Superadmin role and members", async ({ page, request }) => {
    const login = await request.post(origin + "/api/auth/login", { data: { email: superA.email, password } });
    expect(login.ok()).toBeTruthy();
    const session = (login.headers()["set-cookie"] || "").match(/bcstudio_session=([^;]+)/)?.[1];
    await page.context().addCookies([{ name: "bcstudio_session", value: session!, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", secure: false }]);
    await page.goto(origin + "/studio?module=Manajemen+Akun");
    await expect(page.getByRole("heading", { name: "Manajemen pengguna" })).toBeVisible();
    const roleSelect = page.getByLabel("Peran pengguna",{exact:true});
    await expect(roleSelect.locator("option[value='SUPERADMIN']")).toHaveCount(1);
    await expect(page.getByText(superB.email)).toBeVisible();
    await expect(page.getByRole("button", { name: "Kirim ulang aktivasi" }).first()).toBeVisible();
  });
});
