import Discord from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

['TOKEN', 'TWITTER_API_BEARER_TOKEN', 'HOME_GUILD'].forEach((envvar) => {
  if (!process.env[envvar]) {
    throw new Error(`Required environment variable ${envvar} is not set`);
  }
});

// eslint-disable-next-line import/first
import { checkForMaintenance, formatDateTime } from './twitter';

const client = new Discord.Client({ intents: ['GUILD_MESSAGES'] });
client.login(process.env.TOKEN);

client.once('ready', () => {
  const guild = client.guilds.cache.get(process.env.HOME_GUILD as any);
  if (guild) {
    guild.commands.create({ name: 'maintenance', description: 'Displays info about upcoming Arknights global server maintenance' });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    console.log(interaction);
    if (interaction.commandName === 'maintenance') {
      const maintenance = await checkForMaintenance();
      if (!maintenance) {
        interaction.reply('No upcoming maintenance announced.');
      } else if (!maintenance.inFuture) {
        interaction.reply(`No upcoming maintenance announced; most recent maintenance ended ${formatDateTime(maintenance.end)}`);
      } else {
        interaction.reply(`Maintenance starts ${formatDateTime(maintenance.start)} and ends ${formatDateTime(maintenance.end)}`);
      }
    }
  }
});
