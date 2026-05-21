import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { PrismaService } from '../prisma/prisma.service';

type UserSearchDoc = {
  id: number;
  name: string;
  email: string;
  blocked: boolean;
  blockedReason: string | null;
  platformRole: string;
};

type OrganizationSearchDoc = {
  id: number;
  name: string;
  description: string;
  blocked: boolean;
  blockedReason: string | null;
  inviteCode: string;
  joinPolicy?: string;
};

const USERS_INDEX = 'users';
const ORGS_INDEX = 'organizations';

@Injectable()
export class AppElasticsearchService {
  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly prisma: PrismaService,
    @InjectQueue('search') private readonly searchQueue: Queue,
  ) {}

  /** Индексация в фоне: ответ API не ждёт Elasticsearch. */
  scheduleIndexUser(doc: UserSearchDoc): void {
    void this.searchQueue
      .add('index-user', doc, { removeOnComplete: 200, removeOnFail: 50 })
      .catch(() => {
        void this.indexUser(doc);
      });
  }

  scheduleIndexOrganization(doc: OrganizationSearchDoc): void {
    void this.searchQueue
      .add('index-organization', doc, { removeOnComplete: 200, removeOnFail: 50 })
      .catch(() => {
        void this.indexOrganization(doc);
      });
  }

  async ping(): Promise<boolean> {
    try {
      await this.elasticsearchService.ping();
      return true;
    } catch {
      return false;
    }
  }

  async ensureIndices(): Promise<void> {
    try {
      const usersExists = await this.elasticsearchService.indices.exists({ index: USERS_INDEX });
      if (!usersExists) {
        await this.elasticsearchService.indices.create({
          index: USERS_INDEX,
          mappings: {
            properties: {
              id: { type: 'integer' },
              name: { type: 'text' },
              email: { type: 'text' },
              blocked: { type: 'boolean' },
              blockedReason: { type: 'text' },
              platformRole: { type: 'keyword' },
            },
          },
        });
      }

      const orgsExists = await this.elasticsearchService.indices.exists({ index: ORGS_INDEX });
      if (!orgsExists) {
        await this.elasticsearchService.indices.create({
          index: ORGS_INDEX,
          mappings: {
            properties: {
              id: { type: 'integer' },
              name: { type: 'text' },
              description: { type: 'text' },
              blocked: { type: 'boolean' },
              blockedReason: { type: 'text' },
              inviteCode: { type: 'keyword' },
              joinPolicy: { type: 'keyword' },
            },
          },
        });
      }
    } catch {
      // ES optional in local env.
    }
  }

  async indexUser(doc: UserSearchDoc): Promise<void> {
    try {
      await this.ensureIndices();
      await this.elasticsearchService.index({
        index: USERS_INDEX,
        id: String(doc.id),
        document: doc,
        refresh: false,
      });
    } catch {
      // noop
    }
  }

  async indexOrganization(doc: OrganizationSearchDoc): Promise<void> {
    try {
      await this.ensureIndices();
      await this.elasticsearchService.index({
        index: ORGS_INDEX,
        id: String(doc.id),
        document: doc,
        refresh: false,
      });
    } catch {
      // noop
    }
  }

  async removeUser(id: number): Promise<void> {
    try {
      await this.elasticsearchService.delete({ index: USERS_INDEX, id: String(id), refresh: true });
    } catch {
      // noop
    }
  }

  async removeOrganization(id: number): Promise<void> {
    try {
      await this.elasticsearchService.delete({ index: ORGS_INDEX, id: String(id), refresh: true });
    } catch {
      // noop
    }
  }

  async searchUsers(q: string, size = 50): Promise<UserSearchDoc[] | null> {
    try {
      const res = await this.elasticsearchService.search<UserSearchDoc>({
        index: USERS_INDEX,
        size,
        query: {
          multi_match: {
            query: q,
            fields: ['name^2', 'email'],
            fuzziness: 'AUTO',
          },
        },
      });
      return res.hits.hits.map((h) => h._source!).filter(Boolean);
    } catch {
      return null;
    }
  }

  async searchOrganizations(q: string, size = 30): Promise<OrganizationSearchDoc[] | null> {
    try {
      const res = await this.elasticsearchService.search<OrganizationSearchDoc>({
        index: ORGS_INDEX,
        size,
        query: {
          bool: {
            should: [
              {
                match_phrase_prefix: {
                  name: { query: q, boost: 3 },
                },
              },
              { match: { description: { query: q, boost: 1 } } },
              { term: { inviteCode: { value: q, boost: 2 } } },
            ],
            minimum_should_match: 1,
          },
        },
      });
      return res.hits.hits.map((h) => h._source!).filter(Boolean);
    } catch {
      return null;
    }
  }

  async reindexAll(): Promise<{ users: number; organizations: number }> {
    await this.ensureIndices();
    const [users, organizations] = await Promise.all([
      this.prisma.user.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          blocked: true,
          blockedReason: true,
          platformRole: true,
        },
      }),
      this.prisma.organization.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          description: true,
          blocked: true,
          blockedReason: true,
          inviteCode: true,
          joinPolicy: true,
        },
      }),
    ]);

    for (const u of users) {
      await this.indexUser({
        id: u.id,
        name: u.name,
        email: u.email,
        blocked: u.blocked,
        blockedReason: u.blockedReason,
        platformRole: u.platformRole,
      });
    }
    for (const o of organizations) {
      await this.indexOrganization({
        id: o.id,
        name: o.name,
        description: o.description,
        blocked: o.blocked,
        blockedReason: o.blockedReason,
        inviteCode: o.inviteCode,
        joinPolicy: o.joinPolicy,
      });
    }
    return { users: users.length, organizations: organizations.length };
  }
}

