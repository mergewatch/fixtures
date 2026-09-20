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
