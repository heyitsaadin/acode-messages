# Development

Edit the files in `src/`, then run `node build.js` (or `npm run build`). That writes `main.js`,
which is the only code file Acode loads. Never edit `main.js` by hand, it gets overwritten.
`node build.js --watch` rebuilds on every save. Needs Node 18+, no `npm install`.

## Layout

```
src/
  index.js        registers the plugin with Acode
  plugin.js       the AcodeMessages class: constructor + settings, then attaches the feature files
  constants.js    settings and fixed values (the version comes from plugin.json)
  icons.js        icon paths and emoji list
  util.js         localStorage helper, user helpers
  styles.css      all the CSS
  features/       the methods, grouped by feature (one class per file)
```

| File | What's in it |
| --- | --- |
| `launcher.js` | header button / side panel, init, destroy, error flash |
| `network.js` | auth, token, `api()` |
| `ui-helpers.js` | `el`, `ico`, `avatar`, time formatting |
| `page.js` | open/close the page, back button |
| `home.js` | home screen: rail, panel, DMs, friends, "me" tab |
| `sheets.js` | bottom sheets and menus |
| `permissions.js` | group roles checks, group menu, rename, delete, leave |
| `banner.js`, `group-icon.js` | group banner and picture |
| `members.js` | member list, mute, roles, new DM |
| `channels.js` | create, rename, delete channels, private channels, slowmode |
| `friends.js` | friend requests and search |
| `profile.js`, `edit-profile.js` | profile card, activity, editing |
| `chat.js` | channel view and message list |
| `mentions.js` | @mention suggestions, tap a name to mention |
| `message-actions.js` | long-press menu, reply, edit, delete, send |
| `photos.js` | photo picking and message bubbles |
| `voice-messages.js` | recording and playing voice notes |
| `voice-chat.js` | live voice chat (WebRTC) |

All the `features/*.js` classes are merged into `AcodeMessages`, so `this.whatever()` works
from any file. The build fails if two files define a method with the same name.

## Adding a feature

1. Create `src/features/my-feature.js` with `export class MyFeatureMethods { ... }`.
2. Import the constants you use at the top (`import { ls } from "../util.js";`).
3. In `src/plugin.js`, import the class and add it to the `mixin(AcodeMessages, [ ... ])` list.

## Releasing

Zip these files at the top level of the zip: `main.js`, `plugin.json`, `readme.md`,
`changelogs.md`, `icon.png`. Bump `version` in `plugin.json` first; the build copies it into the code.
