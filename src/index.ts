import Discord from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Discord.Client();
client.login(process.env.TOKEN);
client.once('ready', () => {
  console.log('ready!');
});
