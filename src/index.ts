import Discord from 'discord.js';
import dotenv from 'dotenv';
import { DateTime, Duration } from 'luxon';

dotenv.config();

['TOKEN', 'TWITTER_API_BEARER_TOKEN', 'CHECK_FREQUENCY_IN_MINUTES'].forEach((envvar) => {
  if (!process.env[envvar]) {
    throw new Error(`Required environment variable ${envvar} is not set`);
  }
});

// eslint-disable-next-line import/first
import { fetchLatestMaintenanceTweet, formatDateTime } from './twitter';

let start: DateTime | null = null;
let end: DateTime | null = null;
let durationMessage: string | null = null;

const humanizeDuration = (duration: Duration, options?: { short: boolean }): string => {
  let minutePart: string = '';
  let hourPart: string = '';
  let dayPart: string = '';
  if (options?.short) {
    // the lowest unit is a float, so we need to round it
    minutePart = `${Math.round(duration.minutes)}m`;
    hourPart = `${Math.round(duration.hours)}h`;
    dayPart = `${Math.round(duration.days)}d`;
  } else {
    minutePart = Math.round(duration.minutes) === 1 ? '1 minute' : `${Math.round(duration.minutes)} minutes`;
    hourPart = duration.hours === 1 ? '1 hour' : `${duration.hours} hours`;
    dayPart = duration.days === 1 ? '1 day' : `${duration.days} days`;
  }
  return [
    [dayPart, duration.days],
    [hourPart, duration.hours],
    [minutePart, Math.round(duration.minutes)],
  ].filter(([_, value]) => value > 0).map(([str]) => str).join(options?.short ? ' ' : ', ');
};

const checkForMaintenance = async () => {
  const maint = await fetchLatestMaintenanceTweet();
  start = maint?.start ?? null;
  end = maint?.end ?? null;
  const now = DateTime.now();
  if (start && end && start <= now && now <= end) {
    const duration = end.diff(DateTime.now(), ['hours', 'minutes']);
    durationMessage = humanizeDuration(duration, { short: true });
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

client.once('ready', async () => {
  if (!client.application?.owner) {
    await client.application?.fetch();
  }
  console.log('Bot ready.');
  await client.application?.commands.create({ name: 'maintenance', description: 'Displays info about upcoming Arknights global server maintenance' });
  console.log('/maintenance global command created');
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    console.log(interaction);
    if (interaction.commandName === 'maintenance') {
      // four cases:
      // - start & end are null, meaning no tweets matched.
      // - end is in the past, meaning maintenance already concluded.
      // - DateTime.now() is between start and end, meaning maintenance is currently happening
      // - start is in the future, meaning maintenance will happen in the future.
      if (!start || !end) {
        interaction.reply('No upcoming maintenance announced.');
      } else if (DateTime.now() > end) {
        interaction.reply(`No upcoming maintenance announced; most recent maintenance ended ${formatDateTime(end, { withDate: true })}`);
      } else if (DateTime.now() < start) {
        const untilStart = start.diff(DateTime.now(), ['days', 'hours', 'minutes']);
        interaction.reply(`⚠️ **__Upcoming maintenance!__**\n**Start:** ${formatDateTime(start, { withDate: true })}\n(${humanizeDuration(untilStart)} from now)\n**End:** ${formatDateTime(end, { withDate: true })}\n**Duration:** ${humanizeDuration(end.diff(start, ['hours', 'minutes']))}`);
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
  const statusMessage = durationMessage ? `⚠️ Maint ends in ${durationMessage}` : formatDateTime(DateTime.now());
  client.user?.setActivity(statusMessage, { type: 'WATCHING' });
  setTimeout(updateBotActivity, 30000); // every 30 seconds
}());
