import Discord from 'discord.js';
import dotenv from 'dotenv';
import { DateTime, Duration } from 'luxon';

dotenv.config();

['TOKEN', 'TWITTER_API_BEARER_TOKEN', 'HOME_GUILD', 'CHECK_FREQUENCY_IN_MINUTES'].forEach((envvar) => {
  if (!process.env[envvar]) {
    throw new Error(`Required environment variable ${envvar} is not set`);
  }
});

// eslint-disable-next-line import/first
import { fetchLatestMaintenanceTweet, formatDateTime } from './twitter';

let start: DateTime | null = null;
let end: DateTime | null = null;
let durationMessage: string | null = null;

const humanizeDuration = (duration: Duration): string => {
  const minutePart = duration.minutes === 1 ? '1 minute' : `${duration.minutes} minutes`;
  const hourPart = duration.hours === 1 ? '1 hour' : `${duration.hours} hours`;
  if (duration.minutes === 0) {
    return hourPart;
  }
  return `${hourPart}, ${minutePart}`;
};

const checkForMaintenance = async () => {
  const maint = await fetchLatestMaintenanceTweet();
  start = maint?.start ?? null;
  end = maint?.end ?? null;
  const now = DateTime.now();
  if (start && end && start <= now && now <= end) {
    const duration = end.diff(start, ['hours', 'minutes']);
    if (duration.minutes === 0) {
      durationMessage = humanizeDuration(duration);
    }
  } else {
    durationMessage = null;
  }
  console.log('start:', start);
  console.log('end:', end);
  console.log('durationMessage:', durationMessage);
};

const client = new Discord.Client({ intents: ['GUILD_MESSAGES'] });
console.log('Logging in...');
client.login(process.env.TOKEN);

client.once('ready', () => {
  console.log('Bot ready.');
  const guild = client.guilds.cache.get(process.env.HOME_GUILD as any);
  if (guild) {
    guild.commands.create({ name: 'maintenance', description: 'Displays info about upcoming Arknights global server maintenance' });
    console.log('/maintenance command created in guild:', guild);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    console.log(interaction);
    if (interaction.commandName === 'maintenance') {
      if (!start || !end) {
        interaction.reply('No upcoming maintenance announced.');
      } else if (DateTime.now() > end) {
        interaction.reply(`No upcoming maintenance announced; most recent maintenance ended ${formatDateTime(end, { withDate: true })}`);
      } else {
        interaction.reply(`Maintenance will end in ${durationMessage}`);
      }
    }
  }
});

(function checkForMaintenanceRepeatedly() {
  checkForMaintenance();
  setTimeout(checkForMaintenanceRepeatedly, 60000 * +process.env.CHECK_FREQUENCY_IN_MINUTES!);
}());

(function updateBotActivity() {
  const statusMessage = durationMessage ? `⚠️ 🔨 ends in ${durationMessage}` : formatDateTime(DateTime.now());
  client.user?.setActivity(statusMessage, { type: 'WATCHING' });
  setTimeout(updateBotActivity, 30000); // every 30 seconds
}());
