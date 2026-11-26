# Changelog

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
