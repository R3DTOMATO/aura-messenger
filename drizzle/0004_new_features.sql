-- ── Bookmarked Messages ──────────────────────────────────────
CREATE TABLE `message_bookmarks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` bigint NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_bookmarks_id` PRIMARY KEY(`id`),
	CONSTRAINT `msg_user_bookmark` UNIQUE(`messageId`,`userId`)
);
--> statement-breakpoint

-- ── Pinned Messages (채팅방 공지) ────────────────────────────
CREATE TABLE `pinned_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`messageId` bigint NOT NULL,
	`pinnedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pinned_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `conv_msg_pin` UNIQUE(`conversationId`,`messageId`)
);
--> statement-breakpoint

-- ── Invite Links ─────────────────────────────────────────────
CREATE TABLE `invite_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`ownerId` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`usedCount` int NOT NULL DEFAULT 0,
	`maxUses` int,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invite_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `invite_links_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint

-- ── Push Subscriptions ───────────────────────────────────────
CREATE TABLE `push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` varchar(255) NOT NULL,
	`auth` varchar(255) NOT NULL,
	`userAgent` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

-- ── Indexes for search ───────────────────────────────────────
CREATE INDEX `idx_messages_content` ON `messages` (`conversationId`, `createdAt`);
--> statement-breakpoint
CREATE FULLTEXT INDEX `ft_messages_content` ON `messages` (`content`);
