# Changelog

## 1.11.2

- Typing indicator: when someone is typing in a DM or a group channel you have open, you see three dots bouncing in a wave with "Name is typing" above the message box. Only the fact that you are typing is sent, never what you type. Needs the matching server update (acode-messages-server, migration 015); without it nothing is shown and everything else works as before.
- The Account page now says that only you can see your email.

## 1.11.1

- Fixed replies: a reply now stays on the message after you close and reopen the chat, and the person you replied to sees it too. Before, replies only showed on your own screen for a while.
- Replies in direct messages stay end-to-end encrypted: the message you reply to is decrypted on your device.
- Needs the matching server update (migration 016_message_replies.sql and api/messages.js).

## 1.11.0

- Invite links. A group's Invite button now gives you a link (https://your-server/invite/code) as well as the code. Paste the link in any chat and it turns into a Join card with the group's picture, banner, name and online / member counts, like Discord. If you're already in the group the button says Go to Server.
- Send an invite straight to someone: Invite > Send to a friend lists your chats and friends, tap Send. It goes out as a normal message, so in direct messages it is end-to-end encrypted like everything else.
- "Join with an invite link or code" now accepts a pasted link too.
- Opening the link in a browser shows a page with the group card and the steps to join. Opening a link directly inside Acode isn't supported, so that page shows the code to copy.
- Needs the matching server update (api/groups.js, lib/invites.js, vercel.json). No migration. Without it everything still works, links just don't turn into cards.

## 1.10.1

- Removed the server address setting everywhere (in-app Settings and the plugin's Acode settings page). The app always uses the default server, and any address saved by an older version is ignored.
- The Shop / Settings pill is smaller, with the two buttons close together.
- Moving between the profile, Settings and its pages now slides smoothly, forward and back.
- Settings pages only have the back arrow now. The extra round X is gone (the profile keeps its X).

## 1.10.0

- Your own profile now has a floating Shop and Settings pill at the bottom, like Discord's.
- Settings has Account (display name, about me, picture and banner, sign-in info), Appearance, Sounds (send and receive) and Advanced (server address).
- "Who can see your profile" moved from the profile page to Settings > Appearance.
- The back button now steps back through the settings pages before it closes the sheet.
- Shop is a placeholder for now.
- No server update needed. Appearance still needs migration 012, like the old privacy card did.

## 1.9.4

- Text messages now appear the moment you tap send, slightly dimmed, and turn to full colour once the server has them. No more waiting on a blank chat.
- If a message can't be sent, it turns red with "Not sent. Tap to retry". Long press it to retry, copy the text or delete it.
- Photos, voice clips and shared files still wait for the server before they show.
- A soft sound plays when someone else's message arrives in the chat you have open. You can turn it off under Settings > Receive sound.
- The keyboard now stays open when you tap send, so you can keep typing.

## 1.9.3

- A short sound plays when a message is sent. You can turn it off under Settings > Send sound.
- Sending is quicker after a pause. While you type, the plugin now gets ready in the background (renews your login and, in a DM, refreshes the other person's key) instead of doing it after you tap send.
- Fixed the verified badge image not showing (it is now included in the package).

## 1.9.0

- New /share command: type /share and a file name to send a file that is open in an Acode tab. Only open tabs can be shared, and the message box suggests matching tab names as you type.
- Small files arrive as a text code card. Bigger files (up to 1 MB) arrive as a file you can Copy or Open in the editor. Files shared in direct messages are end-to-end encrypted like the messages themselves.
- Code in chat is now syntax highlighted: comments, strings, numbers, keywords, functions and more, for JavaScript/TypeScript, Python, Java, Kotlin, C/C++, C#, Go, Rust, Swift, PHP, shell, JSON, SQL, YAML, CSS and HTML.
- Needs the matching server update (migration 009_file_messages.sql, api/messages.js, lib/attach.js) to send big files. Without it small files and highlighting still work.

## 1.8.0

- Groups are laid out like Discord. Tap the banner or the group name to open the group sheet: picture, name, description, online and member counts, Invite and Members buttons, Create Channel, Create Category, and Leave group.
- Settings moved to their own page. A Settings button on the group sheet (only shown to the owner and people with permissions) opens Group settings: channels, appearance, roles, discovery and delete. The three-dot and Members buttons on the banner are gone, and the channel menu inside a chat now has a single Group settings entry instead of every option.
- Channel categories. Create a category from the group sheet or the Channels list, then collapse or expand it in the channel list. Each category has a + to add a channel to it and a settings button to rename, move up/down or delete it (its channels are kept). Pick a category when you create a channel or edit one.
- Needs the matching server update (migration 014, api/groups.js, api/home.js). Without it everything still works but categories stay unavailable.

## 1.7.0

- Group owners can make their group public from the group menu (Discovery > Public group). Public groups show up under Public groups on the + page and anyone can join without an invite code. Needs a short description.
- Find people now lists everyone with a public profile (online first) before you type anything. Private profiles aren't listed, but can still be found by searching their username.
- The profile privacy choice now says clearly that public profiles are listed in Find people.
- Cleaner Groups page: removed the template cards that all did the same thing, and replaced the big community cards with compact rows. Tap a row to preview the group, then Join.
- Needs the matching server update (api/friends.js, api/groups.js, api/home.js). No new migration.

## 1.6.0

- The + button now opens a Groups page laid out like Discord's: "Create a place for you and your friends", Create a group, I have an invite code, and Join communities.
- Join communities lists public groups with a banner, picture, verified tick, description and online / member counts. Tap Preview, then Join group.
- New groups start with a suggested name you can change.
- Needs the matching server update (migration 013). Without it the community list shows "Couldn't load communities"; creating and joining by code still work.

## 1.5.0

- New setup screen for first-time users: a short welcome, then choose your name, picture, banner and about me, then pick who can see your profile. You can skip it and change everything later.
- Public and private profiles. Public shows your banner, about me and activity to everyone. Private shows them only to friends; everyone else sees just your name and picture, and can still message you or send a friend request.
- Change your privacy any time from Edit profile or the new "Who can see your profile" card on your own profile.
- Needs the matching server update (migration 012). Without it everything stays public and the setup screen doesn't appear.

## 1.4.1

- Your encryption key is now set up as soon as Acode Messages loads, so people can message you right after you update, without you opening a DM first.
- Tidier message headers: the verified badge is smaller and lines up with the name, tags and time.

## 1.4.0

- Direct messages are now end-to-end encrypted. Only you and the person you're talking to can read them; the server only stores scrambled text.
- Both people need to update to this version to message each other. Until they do, sending shows "needs to update Acode Messages first".
- Your encryption key lives on this device. Clearing plugin data or switching devices means older DMs can't be read on the new one.
- Older plain-text DMs still show normally. Group chats are unchanged.
- Needs the matching server update (migration 009).

## 1.3.3

- Adds a personal text-only "Plugin Admin" profile tag for the plugin owner.
- Keeps the Acode Verified rosette logo beside the verified user's name.


## 1.3.1

- Replaces the plain verification check with the Acode verified badge image.
- Labels platform administrators as "Acode Administrator" on profiles.
- Includes the project image folder in release packages.


## 1.3.0

- Share code straight from the editor: select code, tap "Send to chat" in the selection menu (or run "Send selected code to Acode Messages" from the command palette), pick a chat, add a note and send.
- Code in messages now shows as a card with the file name and line numbers, a Copy button and an Open button that opens the snippet as a new file in the editor.
- Code blocks show as "Code" in the chat list and in replies instead of raw backticks.
- Now open source under the MIT License.

## 1.2.0

- Acode Messages now opens as a tab in Acode's tab bar instead of covering the whole screen.
- Back button only controls the chat while its tab is open.
- Older Acode versions without custom tabs still get the full-screen page.

## 1.1.1

- Tap a profile picture in chat to open that person's profile.
- Tap a name in chat to drop @Name into the message box.
- @mentions are now blue, work with names that have spaces (like @Aadin Kc) and open the profile when tapped.
- Type @ and a letter to get name suggestions; tap one to complete it.
- Add friend, Cancel request, Accept and Friends buttons now live right on every profile.
- Redesigned the Notifications page with a proper title, friend request cards and a clear empty state.
- Optional server update: profile now reports friend status.

## 1.1.0

- Group menu is now organised into sections: Community, Channels, Appearance, People & access and Danger zone.
- Channels: owners and people with the new "Manage channels" permission can create, rename, set a topic on and delete channels.
- Private channels: choose which roles and people can see a channel, or use Advanced permissions to set View / Send per role (deny, inherit or allow).
- Slowmode for any channel.
- Giving roles is faster: tap a person, then tap a role. Each role also lists everyone with a switch so you can add people in one tap.
- Needs the matching server update (migration 008).

## 1.0.2

- Cleaner, more minimal profile: Discord-style full-width Edit profile / Message button under the name.
- Removed the Chat activity and Coding activity cards from profiles.
- Pull a profile down from the top to close it.

## 1.0.1

- Profile now opens over a strong frosted blur.
- Smoother profile open animation (slides up, content eases in).
- Fixed the gap above the profile banner.

## 1.0.0

- First stable release.
- Groups, channels, direct messages and friends.
- Photos, voice messages and voice chat.
- Profiles with optional coding activity.
- Discord-style message layout with long-press actions.
