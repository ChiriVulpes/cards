# Cards

A project for automatically deciphering and querying JSON data for cards for various games.

## Testing out the deployed instance


## Setting up and running locally
1. `pnpm install` (or use your node package manager of choice)
2. Create an empty database (I'm using Postgres 15.10 but I don't think I'm using features that are that new, probably safe to be back a couple versions?)
3. Create `.env` and add the environment variable `DATABASE_URl=`, setting the variable to the connection string for your database
4. Run `npx drizzle-kit push` to migrate your database
5. Create `/data` folder, place JSON files to import within it. You can put whatever in here. All files must be specifically JSON arrays containing objects. Invalid JSON files, or invalid data within JSON files, will be ignored
6. Create a file `manifest.json` in the `/data` folder that describes the content of the files. For example:
```json
[
	{
		"file": "lorcana-cards",
		"game": "Lorcana"
	},
	{
		"file": "mtg-cards",
		"game": "Magic: The Gathering"
	}
]
```
7. Build with `npx run dev`
8. Visit the route `/import` to reimport from the `/data` folder to your database
