import Discord from "discord.js";
import dotenv from "dotenv";
import Keyv from "keyv";
import { DateTime, Duration } from "luxon";

dotenv.config();

["TOKEN", "TWITTER_API_BEARER_TOKEN", "CHECK_FREQUENCY_IN_MINUTES"].forEach(
  (envvar) => {
    if (!process.env[envvar]) {
      throw new Error(`Required environment variable ${envvar} is not set`);
    }
  }
);

import { fetchLatestMaintenanceTweet, formatDateTime } from "./twitter";

let durationMessage: string | null = null;
const keyv = new Keyv("sqlite://store.sqlite");

const humanizeDuration = (
  duration: Duration,
  options?: { short: boolean }
): string => {
  let minutePart = "";
  let hourPart = "";
  let dayPart = "";
  if (options?.short) {
    // the lowest unit is a float, so we need to round it
    minutePart = `${Math.round(duration.minutes)}m`;
    hourPart = `${Math.round(duration.hours)}h`;
    dayPart = `${Math.round(duration.days)}d`;
  } else {
    minutePart =
      Math.round(duration.minutes) === 1
        ? "1 minute"
        : `${Math.round(duration.minutes)} minutes`;
    hourPart = duration.hours === 1 ? "1 hour" : `${duration.hours} hours`;
    dayPart = duration.days === 1 ? "1 day" : `${duration.days} days`;
  }
  return [
    [dayPart, duration.days],
    [hourPart, duration.hours],
    [minutePart, Math.round(duration.minutes)],
  ]
    .filter(([_, value]) => value > 0)
    .map(([str]) => str)
    .join(options?.short ? " " : ", ");
};

const checkForMaintenance = async () => {
  const startSeconds = await keyv.get("start");
  const endSeconds = await keyv.get("end");
  const currentStart = startSeconds ? DateTime.fromSeconds(startSeconds) : null;
  const currentEnd = endSeconds ? DateTime.fromSeconds(endSeconds) : null;
  console.log("currentStart:", currentStart);
  console.log("currentEnd:", currentEnd);

  const maint = await fetchLatestMaintenanceTweet();
  console.log("fetch result:", maint);
  if (
    maint?.start &&
    maint?.end &&
    (!currentStart || maint.start > currentStart)
  ) {
    console.log("updating start/end");
    await keyv.set("start", maint.start.toSeconds());
    await keyv.set("end", maint.end.toSeconds());
  }

  const now = DateTime.now();
  if (currentStart && currentEnd && currentStart <= now && now <= currentEnd) {
    const duration = currentEnd.diff(DateTime.now(), ["hours", "minutes"]);
    durationMessage = humanizeDuration(duration, { short: true });
  } else {
    durationMessage = null;
  }
  console.log("durationMessage:", durationMessage);
};

const client = new Discord.Client({ intents: ["GUILD_MESSAGES"] });
console.log("Logging in...");
client.login(process.env.TOKEN);

client.once("ready", async () => {
  if (!client.application?.owner) {
    await client.application?.fetch();
  }
  console.log("Bot ready.");
  await client.application?.commands.create({
    name: "maintenance",
    description:
      "Displays info about upcoming Arknights global server maintenance",
  });
  console.log("/maintenance global command created");

  if (process.env.HOME_GUILD) {
    await client.guilds.cache.get(process.env.HOME_GUILD)?.commands.create({
      name: "maintenance",
      description:
        "[GUILD COMMAND] Displays info about upcoming Arknights global server maintenance",
    });
    console.log(
      `/maintenance guild command created in HOME_GUILD with ID ${process.env.HOME_GUILD}`
    );
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand()) {
    console.log(interaction);
    if (interaction.commandName === "maintenance") {
      // four cases:
      // - start & end are null, meaning no tweets matched.
      // - end is in the past, meaning maintenance already concluded.
      // - DateTime.now() is between start and end, meaning maintenance is currently happening
      // - start is in the future, meaning maintenance will happen in the future.
      const startSeconds = await keyv.get("start");
      const endSeconds = await keyv.get("end");
      const start = startSeconds ? DateTime.fromSeconds(startSeconds) : null;
      const end = endSeconds ? DateTime.fromSeconds(endSeconds) : null;
      if (!start || !end) {
        interaction.reply("No upcoming maintenance announced.");
      } else if (DateTime.now() > end) {
        interaction.reply(
          `No upcoming maintenance announced; most recent maintenance ended <t:${endSeconds}:F>`
        );
      } else if (DateTime.now() < start) {
        const untilStart = start.diff(DateTime.now(), [
          "days",
          "hours",
          "minutes",
        ]);
        interaction.reply(
          `⚠️ **__Upcoming maintenance!__**\n**Start:** <t:${startSeconds}:F>\n(${humanizeDuration(
            untilStart
          )} from now)\n**End:** <t:${endSeconds}:F>\n**Duration:** ${humanizeDuration(
            end.diff(start, ["hours", "minutes"])
          )}`
        );
      } else {
        interaction.reply(`Maintenance will end in ${durationMessage}`);
      }
    }
  }
});

(function checkForMaintenanceRepeatedly() {
  checkForMaintenance();
  setTimeout(
    checkForMaintenanceRepeatedly,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    60000 * +process.env.CHECK_FREQUENCY_IN_MINUTES!
  );
})();

(function updateBotActivity() {
  const statusMessage = durationMessage
    ? `⚠️ Maint ends in ${durationMessage}`
    : formatDateTime(DateTime.now());
  client.user?.setActivity(statusMessage, { type: "WATCHING" });
  setTimeout(updateBotActivity, 30000); // every 30 seconds
})();
