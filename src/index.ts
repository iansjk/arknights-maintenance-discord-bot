import Discord from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Discord.Client({ intents: ['GUILD_MESSAGES', 'GUILD_INTEGRATIONS'] });
client.login(process.env.TOKEN);

client.once('ready', () => {
  const guild = client.guilds.cache.get(process.env.HOME_GUILD as any);
  if (guild) {
    guild.commands.create({ name: 'ping', description: 'Replies with "Pong!"' });
  }
});

client.on('interactionCreate', (interaction) => {
  if (interaction.isCommand()) {
    console.log(interaction);
    if (interaction.commandName === 'ping') {
      interaction.reply('Pong!');
    }
  }
});
