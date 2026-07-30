// Shared Prisma include for task queries (owner + assignees + comments).
export const taskInclude = {
  assignees: { include: { user: { select: { id: true, name: true } } } },
  owner: { select: { id: true, name: true } },
  comments: {
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} as const;
