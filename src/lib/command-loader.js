import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const commandsDirectory = path.join(__dirname, '..', 'commands');

export async function loadCommands() {
  const files = (await readdir(commandsDirectory))
    .filter((file) => file.endsWith('.js'))
    .sort();

  const commands = [];

  for (const file of files) {
    const commandPath = path.join(commandsDirectory, file);
    const command = await import(pathToFileURL(commandPath).href);

    if (!command.data || typeof command.execute !== 'function') {
      throw new Error(`${file} must export data and execute.`);
    }

    commands.push(command);
  }

  return commands;
}
