import { cloudDatabase } from "./cloudDb";

export async function readCloudDocument(key: string): Promise<unknown | undefined> {
  const document = await cloudDatabase().appDocument.findUnique({ where: { key } });
  return document ? JSON.parse(document.value) : undefined;
}

export async function writeCloudDocument(key: string, value: unknown) {
  const serialized = JSON.stringify(value);
  await cloudDatabase().appDocument.upsert({
    where: { key }, create: { key, value: serialized }, update: { value: serialized }
  });
}
