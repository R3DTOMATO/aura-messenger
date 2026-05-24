-- Local auth: password hash column
ALTER TABLE `users` ADD `passwordHash` varchar(255);
