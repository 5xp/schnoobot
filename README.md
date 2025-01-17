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
![image](https://github.com/user-attachments/assets/e30c90d8-d165-4bb8-b041-cc68bdd3dfe4)
![image](https://github.com/user-attachments/assets/a101611e-4eab-4c23-bbcb-f43fa8049a49)
![image](https://github.com/user-attachments/assets/c764a67c-73c6-4bcf-b35c-e4cbbd8eedb9)
![image](https://github.com/5xp/schnoobot/assets/62446202/385b649d-317e-4c32-95b4-bbaebe373150)

## Setup
1. Clone the repository.
2. Install dependencies using `npm install`.
3. Build the project using `npm run build`.
4. Create a `.env` file in the root of the project, and define the variables:
```
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_bot_client_id
DB_FILE_NAME=your_sqlite_db_file_name
```
Optionally, you can also define the following variables:
```
GUILD_ID=your_guild_id # Used for single-server deployment
COOKIES_FILE_NAME # Used for download commands
ANILIST_CLIENT_ID # Used for AniList API
ANILIST_CLIENT_SECRET # Used for AniList API
ANILIST_REDIRECT_URI # Used for AniList API
```
5. Initialize the SQLite database using `npm run drizzle:push`.
6. Deploy the commands globally using `npm run deploy:global`. If you have defined `GUILD_ID`, you can run `npm run deploy:guild` to deploy the commands to that guild only.
7. Run `npm start` to start Schnoobot. 
