// Shared Prisma include for task queries (owner + assignee + comments).
export const taskInclude = {
  assignee: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  comments: {
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} as const;
