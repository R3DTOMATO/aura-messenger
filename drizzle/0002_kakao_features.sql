-- Friends table
CREATE TABLE `friends` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`friendId` int NOT NULL,
	`nickname` varchar(80),
	`isFavorite` boolean NOT NULL DEFAULT false,
	`isHidden` boolean NOT NULL DEFAULT false,
	`isBlocked` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `friends_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_friend_pair` UNIQUE(`userId`,`friendId`)
);
--> statement-breakpoint
-- Message reactions
CREATE TABLE `message_reactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` bigint NOT NULL,
	`userId` int NOT NULL,
	`emoji` varchar(16) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_reactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `msg_user_emoji` UNIQUE(`messageId`,`userId`,`emoji`)
);
--> statement-breakpoint
-- Add profile fields to users
ALTER TABLE `users` ADD `statusMessage` varchar(140);
--> statement-breakpoint
ALTER TABLE `users` ADD `backgroundUrl` text;
--> statement-breakpoint
-- Add to conversations
ALTER TABLE `conversations` ADD `avatarUrl` text;
--> statement-breakpoint
ALTER TABLE `conversations` ADD `createdBy` int;
--> statement-breakpoint
-- Add per-user chatroom settings
ALTER TABLE `conversation_participants` ADD `isPinned` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `conversation_participants` ADD `isMuted` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `conversation_participants` ADD `customName` varchar(120);
--> statement-breakpoint
-- Add system message type, reply-to, editedAt
ALTER TABLE `messages` MODIFY `type` enum('text','image','file','system') NOT NULL DEFAULT 'text';
--> statement-breakpoint
ALTER TABLE `messages` ADD `replyToId` bigint;
--> statement-breakpoint
ALTER TABLE `messages` ADD `editedAt` timestamp;
