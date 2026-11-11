import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { isAdminRole, isReviewerRole, REVIEWER_ROLES } from "../lib/rbac";

const db = new PrismaClient();
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:3183";
const ids: { users: string[]; books: string[] } = { users: [], books: [] };

test.afterAll(async () => {
  if (ids.books.length) await db.book.deleteMany({ where: { id: { in: ids.books } } });
  if (ids.users.length) await db.studioUser.deleteMany({ where: { id: { in: ids.users } } });
  await db.$disconnect();
});

async function actor(role: "EDITOR" | "REVIEWER" | "ADMIN" | "SUPERADMIN") {
  const user = await db.studioUser.create({
    data: {
      role,
      active: true,
      name: "RBAC QA " + role,
      email: "qa-superadmin-rbac-" + role.toLowerCase() + "-" + randomBytes(6).toString("hex") + "@example.invalid",
    },
  });
  ids.users.push(user.id);
  const token = randomBytes(32).toString("hex");
  await db.studioSession.create({
    data: {
      userId: user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });
  return { ...user, token };
}

function cookie(token: string) {
  return { cookie: "bcstudio_session=" + token };
}

async function api(token: string | null, path: string, method = "GET", data?: unknown) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      ...(token ? cookie(token) : {}),
      ...(data !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  return { status: response.status, body };
}

test("helper treats SUPERADMIN as a reviewer and admin superset without widening other roles", () => {
  expect(REVIEWER_ROLES).toEqual(["REVIEWER", "ADMIN", "SUPERADMIN"]);
  expect(isReviewerRole("EDITOR")).toBe(false);
  expect(isReviewerRole("REVIEWER")).toBe(true);
  expect(isReviewerRole("ADMIN")).toBe(true);
  expect(isReviewerRole("SUPERADMIN")).toBe(true);
  expect(isAdminRole("EDITOR")).toBe(false);
  expect(isAdminRole("REVIEWER")).toBe(false);
  expect(isAdminRole("ADMIN")).toBe(true);
  expect(isAdminRole("SUPERADMIN")).toBe(true);
});

test("SUPERADMIN inherits EDITOR work and assigned ADMIN/REVIEWER rights; other roles stay unchanged", async ({ page, context, browser }) => {
  const owner = await actor("EDITOR");
  const reviewer = await actor("REVIEWER");
  const admin = await actor("ADMIN");
  const superadmin = await actor("SUPERADMIN");
  const other = await actor("EDITOR");

  const created = await api(superadmin.token, "/api/books", "POST", {
    title: "Buku milik Superadmin QA",
    grade: "7",
    subject: "Bahasa",
    bookType: "NONFICTION",
    genre: "REFERENCE",
  });
  expect(created.status).toBe(201);
  ids.books.push(created.body.book.id);

  const book = (await api(owner.token, "/api/books", "POST", {
    title: "Buku review Superadmin QA",
    grade: "7",
    subject: "Bahasa",
    bookType: "NONFICTION",
    genre: "REFERENCE",
  })).body.book;
  ids.books.push(book.id);
  const path = "/api/books/" + book.id;

  expect((await api(null, path)).status).toBe(401);
  expect((await api(other.token, path)).status).toBe(404);
  expect((await api(admin.token, path)).status).toBe(404);
  expect((await api(superadmin.token, path)).status).toBe(404);

  const brief = await api(owner.token, path, "PATCH", {
    expectedVersion: book.updatedAt,
    description: "Naskah uji RBAC Superadmin dengan sinopsis yang cukup panjang.",
    targetAudience: "Siswa kelas VII",
    writingGoal: "Menguji izin review Superadmin.",
    editorialChecks: { objectives: true, sources: true, assessment: true, expert: true, rights: true },
  });
  expect(brief.status).toBe(200);
  expect((await api(owner.token, path + "/workflow", "POST", { to: "OUTLINE" })).status).toBe(200);
  const chapter = (await api(owner.token, path + "/chapters", "POST", {
    title: "Bab uji RBAC",
    outlineObjective: "Menyelesaikan naskah uji izin review.",
  })).body.chapter;
  expect((await api(owner.token, path + "/workflow", "POST", { to: "WRITING" })).status).toBe(200);
  expect((await api(owner.token, path + "/chapters/" + chapter.id, "PATCH", {
    title: chapter.title,
    outlineObjective: chapter.outlineObjective,
    content: "Ini naskah uji integrasi RBAC Superadmin yang cukup panjang untuk lolos gerbang review.",
    expectedVersion: chapter.updatedAt,
  })).status).toBe(200);

  expect((await api(owner.token, path + "/reviewers", "POST", { email: other.email })).status).toBe(404);
  expect((await api(owner.token, path + "/reviewers", "POST", { email: reviewer.email })).status).toBe(201);
  expect((await api(owner.token, path + "/reviewers", "POST", { email: superadmin.email })).status).toBe(201);
  expect((await api(owner.token, path + "/review", "POST", { action: "submit", note: "" })).status).toBe(200);

  expect((await api(superadmin.token, path)).status).toBe(200);
  const foreign = await api(other.token, "/api/books", "POST", {
    title: "Buku asing Superadmin QA",
    grade: "8",
    subject: "IPA",
    bookType: "NONFICTION",
    genre: "REFERENCE",
  });
  expect(foreign.status).toBe(201);
  ids.books.push(foreign.body.book.id);

  const listed = await api(superadmin.token, "/api/books");
  expect(listed.status).toBe(200);
  expect(listed.body.books.some((item: { id: string }) => item.id === book.id)).toBeTruthy();
  expect(listed.body.books.some((item: { id: string }) => item.id === created.body.book.id)).toBeTruthy();
  expect(listed.body.books.some((item: { id: string }) => item.id === foreign.body.book.id)).toBeFalsy();

  const reviewerFeed = await api(superadmin.token, "/api/reviewer");
  expect(reviewerFeed.status).toBe(200);
  const assignment = reviewerFeed.body.assignments.find((row: { book: { id: string; canReview: boolean } }) => row.book.id === book.id);
  expect(assignment?.book.canReview).toBe(true);

  expect((await api(owner.token, "/api/books/" + book.id + "/review", "POST", { action: "approve", note: "self" })).status).toBe(403);
  expect((await api(admin.token, "/api/books/" + book.id + "/review", "POST", { action: "approve", note: "unassigned admin" })).status).toBe(403);
  expect((await api(reviewer.token, path)).status).toBe(200);
  expect((await api(superadmin.token, path + "/review", "POST", { action: "approve", note: "Disetujui oleh Superadmin yang ditugaskan secara independen." })).status).toBe(200);

  expect((await api(owner.token, "/api/publisher")).status).toBe(403);
  expect((await api(admin.token, "/api/publisher")).status).toBe(200);
  expect((await api(superadmin.token, "/api/publisher")).status).toBe(200);

  await context.addCookies([{ name: "bcstudio_session", value: owner.token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", secure: false }]);
  await page.goto(origin + "/reviewer");
  await expect(page).toHaveURL(/\/studio/);

  const superContext = await browser.newContext();
  await superContext.addCookies([{ name: "bcstudio_session", value: superadmin.token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", secure: false }]);
  const superPage = await superContext.newPage();
  await superPage.goto(origin + "/reviewer");
  await expect(superPage).toHaveURL(/\/reviewer/);
  await expect(superPage.getByText("Superadmin", { exact: true })).toBeVisible();
  await superContext.close();
});
