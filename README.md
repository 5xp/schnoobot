# Schnoobot
Schnoobot is built with TypeScript and discord.js and supports slash commands.

## Commands
- **Casino commands**
  - **Mines**: 5x5 grid filled with mines. Stakes and rewards are customizable.
  - **Limbo**: Choose your own multiplier.
  - **Coinflip**: Flip a coin.
  - **Daily**: Win a daily reward, with higher consecutive streaks yielding higher rewards.
- **DL**: Download audio/video from any supported link. Supports context menu interactions, allowing downloading of a link found in a message.
- **Wiki**: View articles from any [supported wiki](#supported-wikis).
- **Create-Emoji**: Create emojis with just a URL or attachment.
- **Avatar**: View any user's global or server-specific avatar.

## Supported wikis
- [The Binding of Isaac: Rebirth](https://bindingofisaacrebirth.fandom.com/)
- [Risk of Rain 2](https://riskofrain2.fandom.com/)

## Invite
[Invite Schnoobot to your server](https://discord.com/api/oauth2/authorize?client_id=744858122673455177&permissions=1073741824&scope=applications.commands%20bot)

## Screenshots
![image](https://github.com/5xp/schnoobot/assets/62446202/76b5d865-e212-4b5d-89f7-142eb9381c0a)
![image](https://github.com/5xp/schnoobot/assets/62446202/385b649d-317e-4c32-95b4-bbaebe373150)

## Setup
1. Clone the repository.
2. Install dependencies using `npm install`.
3. Build the project using `npm run build`.
4. Initialize the SQLite database using `npm run init-db`.
5. Create a `.env` file in the root of the project, and define the variables:
```
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_bot_client_id
```
6. If using this bot in a single server, you can also define the variable `GUILD_ID`.
7. Deploy the commands globally using `npm run deploy -- --global`. If you have defined `GUILD_ID`, you can run `npm run deploy` to deploy the commands to that guild only.
8. Run `npm start` to start Schnoobot. 
