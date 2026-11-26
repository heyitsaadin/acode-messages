<p align="center"><img src="https://raw.githubusercontent.com/heyitsaadin/acode-messages-images/main/banner.png" width="100%" alt="Acode Messages"></p>

<p align="center">
<a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green" alt="License"></a>
<img src="https://img.shields.io/badge/Acode-Plugin-blue?logo=android&logoColor=white" alt="Acode Plugin">
<img src="https://img.shields.io/badge/version-1.1.1-brightgreen" alt="Version">
</p>

<p align="center">
<img src="https://img.shields.io/badge/Chat-Groups%20%26%20DMs-5865F2" alt="Chat">
<img src="https://img.shields.io/badge/Calls-Voice%20chat-orange" alt="Voice chat">
<img src="https://img.shields.io/badge/Media-Photos%20%26%20voice-purple" alt="Media">
</p>

<p align="center"><b>Chat with other Acode users, right inside Acode.</b><br>Join the community, make friends and talk code without ever leaving your editor.</p>

---

## About

Acode Messages adds a full chat app to Acode. Jump into groups and channels, message friends directly, send photos and voice notes, or hop on a voice chat while you code.

- **Built in:** no extra app, no switching windows.
- **Familiar:** a Discord-style layout that feels natural from the first message.
- **Social:** profiles, friends and an optional coding streak you can share.
- **Private by choice:** your coding activity is only shared if you turn it on, and never includes your code or file names.

## Features

### Groups

Create a group with its own channels and roles, or join one with an invite code.

<p align="center"><img src="https://raw.githubusercontent.com/heyitsaadin/acode-messages-images/main/groups-create.png" width="280" alt="Create a group"></p>

Public groups can be joined by anyone, no code needed.

<p align="center"><img src="https://raw.githubusercontent.com/heyitsaadin/acode-messages-images/main/groups-explore.png" width="280" alt="Public groups"></p>

### Direct messages

Direct messages are end-to-end encrypted. Group chats are not.

<p align="center"><img src="https://raw.githubusercontent.com/heyitsaadin/acode-messages-images/main/dm.png" width="280" alt="Direct messages"></p>

### Profiles

Set an avatar, banner and about me. A public profile shows your banner, about me and activity to everyone and lists you in Find people. A private profile shows only your name and picture to anyone who isn't your friend.

<p align="center"><img src="https://raw.githubusercontent.com/heyitsaadin/acode-messages-images/main/edit-profile.png" width="280" alt="Profile"></p>

### Channels

Create, rename and delete channels, set topics and slowmode, make channels private, and choose which roles can view or send.

### Chat

Long-press a message for Reply, Copy Text, Mention and Copy Message ID. On your own messages you can also edit or delete, and double-tap opens the editor.

### Friends

Find people and add them as friends.

### Photos and voice messages

Send photos and voice notes in any chat.

### Voice chat

Talk to people while you code.

## Install

In Acode open **Plugins → + → Remote** and paste:

```
https://github.com/heyitsaadin/acode-messages/releases/latest/download/acode-messages.zip
```

## Good to know

- **Sign in first.** You need to be logged in to your Acode account (Profile → Login).
- **Where the button is.** On an Acode build with `acode.addHeaderButton`, the chat icon sits in the top bar. On any other build it appears in the side panel instead: tap its icon, then **Open Acode Messages**.
- **Mic.** Voice messages and voice chat need the microphone permission declared in your Acode build. Without it you'll see "Microphone is blocked". Everything else works without it.
- **Calls on mobile data.** Voice chat is peer to peer, so it may not connect between two phones on mobile data.

Community group code: `acode`

## What's new in 1.1

- Channel management: create, rename, set topics, slowmode and delete channels.
- Private channels and per-role View / Send permissions, Discord style.
- A tidier group menu and one-tap role assignment.

## What was new in 1.0

- First stable release.
- Discord-style layout: avatar, name and time on top, plain text below.
- Long-press any message for Reply, Copy Text, Mention and Copy Message ID. On your own messages you also get Edit Message and Delete Message. Double-tap your own message to edit it.

## License

Acode Messages is open source under the [MIT License](LICENSE). You can use, copy, modify and share the code, as long as the copyright and license notice stay with it.

Copyright (c) 2026 heyitsaadin

## Privacy Policy

Last updated: November 26, 2026

**What is stored.** Your Acode account details (name, username, avatar), the profile info you add (banner, about me, Public/Private setting), and the messages, photos and voice messages you send.

**Direct messages.** They are end-to-end encrypted. The encryption key is created on your device and never leaves it, and the server only stores the encrypted text. Your public key is uploaded so friends can message you. If you clear the app's data or change device, you may not be able to read older direct messages.

**Group chats.** They are not end-to-end encrypted. Members of the group can read them, and so can the server. Public groups can be previewed by anyone.

**Profiles.** Public profiles are visible to everyone. Private profiles are visible only to friends.

**Coding activity.** Only shared if you turn it on. It never includes your code or file names.

**Microphone.** Used only for voice messages and voice chat, and only if you allow it.

**Deleting your data.** You can delete your own messages and leave groups. To have your account data removed, open an issue on the [issue tracker](https://github.com/heyitsaadin/acode-messages/issues).

If this policy changes, the date above will change too.

## Terms of Use

Last updated: November 26, 2026

By using Acode Messages you agree to the following.

- You need an Acode account and you're responsible for what happens on it.
- Don't harass, threaten, impersonate or spam people. Don't post illegal content or malware.
- You own what you post. By posting it you let the service store it and show it to the people you send it to.
- Group owners and admins manage their groups. Content or accounts that break these terms can be removed.
- Don't try to break, overload or scrape the service.
- The service is free and provided as is. It may go down, change, or lose messages, and the developer isn't liable for losses from using it.
- The plugin's code is under the [MIT License](LICENSE). These terms cover the chat service.
- These terms can change. Continuing to use the plugin means you accept the new version.

Questions or issues: [github.com/heyitsaadin/acode-messages/issues](https://github.com/heyitsaadin/acode-messages/issues)
