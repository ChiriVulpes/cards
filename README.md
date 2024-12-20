# Cards

A project for automatically deciphering and querying JSON data for cards for various games.

## Testing out the deployed instance
URL: TBD

### Pagination
The default (and maximum) page size is 100, but you can tweak this with, for example `page_size=50` if you only need a small subset of cards.

If there are more cards available, `has_more` on the response object will be `true`.

To get the next page, use `page=N`, where `N` is `page + 1` (`page` is available on the response object if you need it.)

### Filtering
Some filters support both "partial" and "exact" matching. For example:
- Filtering by partial name: `name=magic` includes results such as `"I Call on the Ancient Magics"` or `"Magica De Spell - Thieving Sorceress"`
- Filtering by exact name: `name="zombie cheese magician"` only returns cards with that exact name (case insensitive.)

**Note:** Most string filters are case insensitive.

Here are the supported filters:

#### Name
`name=VALUE` or `name="VALUE"`  

Examples: 
- `/query?name=dragon`
- `/query?name="The Sword Released"`

#### Game
`game=VALUE` or `game="VALUE"`

Examples:
- `/query?game=mtg`
- `/query?game=magic`
- `/query?game=lorcana`
- `/query?game="Magic: The Gathering"`

#### ID
`id=VALUE`  
Filters by a UUID assigned to each card. Note that UUIDs may change (in rare cases.)

Example: `/query?id=ff722403-5dbe-492c-b544-82baf1c50f18`

#### OID
`oid=VALUE`  
Filters by the "original" id associated with cards. Because cards can be sourced from multiple different data sets, these IDs may not be unique across games.

Example: `/query?oid=improvise`

#### Attribute Equals
`attributes.NAME=VALUE`  
Filters by cards that have an attribute of the name `NAME` set to `VALUE`.

If that attribute can never be set to that `VALUE`, the query will return a 400 error.

Examples:
- `/query?attributes.rarity=common&attributes.ink_cost=1`

#### Attribute Equals Any Of
`attributes.NAME=VALUE1,VALUE2`  
Filters by cards that have an attribute of the name `NAME` set to any of the provided values.

If the attribute can never be set to any of the provided values, the query will return a 400 error.

Examples:
- `/query?attributes.rarity=common,uncommon`
- `/query?attributes.color=w,g`

#### Attribute Matches Range
`attributes.NAME=MIN..MAX`  
Filters by cards that have a numeric attribute of the name `NAME` that matches the given range.

Note that `MAX` is *exclusive*. The range follows this expression: `attributes.NAME >= MIN && attributes.NAME < MAX`

If `MIN` is not provided, the range will be open on the bottom. IE, the expression will just be `attributes.NAME < MAX`

If `MAX` is not provided, the range will be open on the top. IE, the expression will just be `attributes.NAME >= MIN`

`..` on its own is ignored, that just matches everything.

Examples:
- `/query?attributes.ink_cost=..3` — cards where ink cost is less than 3
- `/query?attributes.ink_cost=7..` — cards where ink cost is 7 or greater
- `/query?attributes.ink_cost=4..7` — cards where ink cost is at least 4 and less than 7

**You can also use range checks within an "any of" list.**  
Example: `/query?attributes.ink_cost=..3,8..` — cards where ink cost is less than 3 or at least 8

## Setting up and running locally
1. `pnpm install` (or use your node package manager of choice)
2. Create an empty database (I'm using Postgres 15.10 but I don't think I'm using features that are that new, probably safe to be back a couple versions?)
3. Create `.env` and add the environment variable `DATABASE_URl=`, setting the variable to the connection string for your database
4. Run `npx drizzle-kit migrate` to migrate your database
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
		"game": "Magic: The Gathering",
		"aliases": ["mtg"]
	}
]
```
7. Build with `npx run dev`
8. Visit the route `/import` to reimport from the `/data` folder to your database
9. You can now use the `/query` route locally!
