export const BOOK_LIST_STATUSES = ["DRAFT", "REVIEW", "APPROVED"] as const;
export const BOOK_LIST_STAGES = ["BRIEF", "OUTLINE", "WRITING", "EDITING", "REVIEW", "LAYOUT"] as const;
export type BookListStatus = (typeof BOOK_LIST_STATUSES)[number];
export type BookListStage = (typeof BOOK_LIST_STAGES)[number];

export type BookListQuery = {
  q: string;
  status: BookListStatus | null;
  stage: BookListStage | null;
  page: number;
  limit: number | null;
  paginate: boolean;
};

export function parseBookListQuery(params: { get(name: string): string | null }): { error: string } | BookListQuery {
  const q = (params.get("q") ?? "").trim().slice(0, 120);
  const statusRaw = (params.get("status") ?? "").trim();
  const stageRaw = (params.get("stage") ?? params.get("editorialStage") ?? "").trim();
  if (statusRaw && !(BOOK_LIST_STATUSES as readonly string[]).includes(statusRaw)) return { error: "Status tidak dikenal." };
  if (stageRaw && !(BOOK_LIST_STAGES as readonly string[]).includes(stageRaw)) return { error: "Tahap tidak dikenal." };
  const pageParam = params.get("page");
  const limitParam = params.get("limit");
  const paginate = pageParam !== null || limitParam !== null;
  const pageNumber = Math.floor(Number(pageParam || "1"));
  const limitNumber = Math.floor(Number(limitParam || "20"));
  const page = paginate ? Math.max(1, Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1) : 1;
  const limit = paginate ? Math.min(100, Math.max(1, Number.isFinite(limitNumber) && limitNumber > 0 ? limitNumber : 20)) : null;
  return {
    q,
    status: statusRaw ? statusRaw as BookListStatus : null,
    stage: stageRaw ? stageRaw as BookListStage : null,
    page,
    limit,
    paginate,
  };
}

/** Extra Prisma filters. Callers AND this with the existing visibility scope. */
export function bookListFilter(query: BookListQuery): { title?: { contains: string; mode: "insensitive" }; status?: BookListStatus; editorialStage?: BookListStage } {
  return {
    ...(query.q ? { title: { contains: query.q, mode: "insensitive" as const } } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.stage ? { editorialStage: query.stage } : {}),
  };
}

export function bookListPage<T>(rows: T[], query: BookListQuery, total: number) {
  const pageSize = query.limit ?? rows.length;
  return {
    page: query.page,
    pageSize,
    total,
    hasMore: query.limit !== null && query.page * query.limit < total,
  };
}
