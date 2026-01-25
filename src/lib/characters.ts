import { storagePath, listDirectories, readJson, ensureDir } from "@/lib/storage";
import type { Character } from "@/types";

const CHARACTERS_DIR = storagePath("characters");

export async function getCharacters(): Promise<Character[]> {
    await ensureDir(CHARACTERS_DIR);
    const ids = await listDirectories(CHARACTERS_DIR);

    const characterPromises = ids.map(async (id) => {
        const filePath = storagePath("characters", id, "character.json");
        try {
            return await readJson<Character>(filePath);
        } catch {
            return null;
        }
    });

    const results = await Promise.all(characterPromises);
    return results.filter((char): char is Character => char !== null);
}
