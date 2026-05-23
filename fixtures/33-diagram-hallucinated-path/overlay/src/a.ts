// E2E-33 fixture: single-file refactor that IMPLIES a larger module structure
// (UserRepo → suggests db.ts, types/user.ts, etc.) — the diagram agent often
// invents related file nodes. FP-D's parseDiagramResponse validates every
// path-shaped token in the diagram against the PR's changed-files set; any
// cited path that doesn't match → the ENTIRE diagram is dropped.
export class UserRepo {
  async findById(id: number): Promise<{ id: number; name: string } | null> {
    return globalThis.db.users.findOne({ id });
  }

  async listByName(query: string): Promise<{ id: number; name: string }[]> {
    return globalThis.db.users.find({ name: { $regex: query } });
  }
}

declare global {
  // eslint-disable-next-line no-var
  var db: {
    users: {
      findOne(q: object): Promise<{ id: number; name: string } | null>;
      find(q: object): Promise<{ id: number; name: string }[]>;
    };
  };
}

export {};
