import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const people = [
  {
    email: "aoi@acme.test",
    name: "Aoi Sato",
    description:
      "Acme のオーナーで、クリアランスは機密まで。Nimbus ではゲストかつ公開レベルです。同じ人でも組織ごとに属性が変わります。",
  },
  {
    email: "ben@acme.test",
    name: "Ben Ito",
    description:
      "Acme の管理者です。監査 API は有効ですが、クリアランスが社内までなので機密本文はマスクされます。",
  },
  {
    email: "chloe@acme.test",
    name: "Chloe Kim",
    description:
      "Acme エンジニアリングのメンバーです。組織公開、自部門、自分が所有するプロジェクトを扱います。",
  },
  {
    email: "dana@acme.test",
    name: "Dana Mori",
    description: "Acme 営業のメンバーです。クリアランスは公開のみで、社内本文はマスク、機密本文は置き換えになります。",
  },
  {
    email: "evan@acme.test",
    name: "Evan Berg",
    description: "Acme のゲストです。契約には作成が含まれますが、ゲストなのでボタンは無効です。著者メールは置き換えられます。",
  },
  {
    email: "faye@nimbus.test",
    name: "Faye Okada",
    description: "Nimbus のオーナーです。契約が Starter なので、作成も監査も画面に出ません。",
  },
] as const;

async function main() {
  await prisma.document.deleteMany();
  await prisma.project.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  const users = await prisma.user.createManyAndReturn({ data: [...people] });
  const byEmail = Object.fromEntries(users.map((user) => [user.email, user]));
  const aoi = byEmail["aoi@acme.test"];
  const ben = byEmail["ben@acme.test"];
  const chloe = byEmail["chloe@acme.test"];
  const dana = byEmail["dana@acme.test"];
  const evan = byEmail["evan@acme.test"];
  const faye = byEmail["faye@nimbus.test"];

  if (!aoi || !ben || !chloe || !dana || !evan || !faye) {
    throw new Error("seed users were not created");
  }

  await prisma.organization.create({
    data: {
      name: "Acme",
      slug: "acme",
      plan: "enterprise",
      memberships: {
        create: [
          { userId: aoi.id, role: "owner", department: "engineering", clearance: 3 },
          { userId: ben.id, role: "admin", department: "engineering", clearance: 2 },
          { userId: chloe.id, role: "member", department: "engineering", clearance: 2 },
          { userId: dana.id, role: "member", department: "sales", clearance: 1 },
          { userId: evan.id, role: "guest", department: "engineering", clearance: 2 },
        ],
      },
      projects: {
        create: [
          {
            title: "Platform API",
            department: "engineering",
            visibility: "organization",
            status: "active",
            ownerId: chloe.id,
            documents: {
              create: [
                {
                  title: "Public overview",
                  body: "組織の誰でも読める公開資料です。",
                  classificationRank: 1,
                  status: "published",
                  authorId: chloe.id,
                },
                {
                  title: "Runbook",
                  body: "公開済みの社内手順です。",
                  classificationRank: 2,
                  status: "published",
                  authorId: chloe.id,
                },
                {
                  title: "Internal design",
                  body: "まだ下書きの設計メモです。",
                  classificationRank: 2,
                  status: "draft",
                  authorId: chloe.id,
                },
                {
                  title: "Confidential keys",
                  body: "本番の鍵の所在です。",
                  classificationRank: 3,
                  status: "published",
                  authorId: aoi.id,
                },
              ],
            },
          },
          {
            title: "Sales pipeline",
            department: "sales",
            visibility: "department",
            status: "active",
            ownerId: dana.id,
            documents: {
              create: [
                {
                  title: "Q4 forecast",
                  body: "営業部門向けの予測です。",
                  classificationRank: 1,
                  status: "published",
                  authorId: dana.id,
                },
              ],
            },
          },
          {
            title: "Ben draft",
            department: "engineering",
            visibility: "private",
            status: "draft",
            ownerId: ben.id,
            documents: {
              create: [
                {
                  title: "Scratch note",
                  body: "Ben だけの下書きです。",
                  classificationRank: 1,
                  status: "draft",
                  authorId: ben.id,
                },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.organization.create({
    data: {
      name: "Nimbus",
      slug: "nimbus",
      plan: "starter",
      memberships: {
        create: [
          { userId: faye.id, role: "owner", department: "research", clearance: 3 },
          { userId: aoi.id, role: "guest", department: "research", clearance: 1 },
        ],
      },
      projects: {
        create: [
          {
            title: "Vaccine study",
            department: "research",
            visibility: "organization",
            status: "active",
            ownerId: faye.id,
            documents: {
              create: [
                {
                  title: "Public abstract",
                  body: "研究の公開要旨です。",
                  classificationRank: 1,
                  status: "published",
                  authorId: faye.id,
                },
                {
                  title: "Confidential results",
                  body: "未発表の結果です。",
                  classificationRank: 3,
                  status: "published",
                  authorId: faye.id,
                },
              ],
            },
          },
        ],
      },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
