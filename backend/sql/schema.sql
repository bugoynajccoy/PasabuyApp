CREATE DATABASE IF NOT EXISTS pasabuy CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pasabuy;
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, username VARCHAR(20) NOT NULL UNIQUE, email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(15) NOT NULL DEFAULT '', password_hash VARCHAR(100) NOT NULL, role ENUM('user','admin') NOT NULL DEFAULT 'user',
  account_status ENUM('active','suspended') NOT NULL DEFAULT 'active', verified TINYINT(1) NOT NULL DEFAULT 0,
  bio VARCHAR(255) NOT NULL DEFAULT '', avatar MEDIUMTEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS posts (
  id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, type ENUM('request','trip') NOT NULL, title VARCHAR(150) NOT NULL, description TEXT,
  image MEDIUMTEXT NULL, origin VARCHAR(100) NOT NULL, destination VARCHAR(100) NOT NULL,
  budget DECIMAL(10,2) NULL, quantity INT NULL, needed_date DATE NULL,
  service_fee DECIMAL(10,2) NULL, space_left INT NULL, travel_date DATE NULL, return_date DATE NULL,
  status ENUM('active','closed','removed') NOT NULL DEFAULT 'active', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id), INDEX (type,status), INDEX (destination));
CREATE TABLE IF NOT EXISTS offers (
  id CHAR(36) PRIMARY KEY, post_id CHAR(36) NOT NULL, traveler_id CHAR(36) NOT NULL, requester_id CHAR(36) NOT NULL,
  proposed_price DECIMAL(10,2) NOT NULL, message VARCHAR(500) NOT NULL DEFAULT '',
  status ENUM('pending','accepted','rejected','cancelled') NOT NULL DEFAULT 'pending', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id), FOREIGN KEY (traveler_id) REFERENCES users(id), FOREIGN KEY (requester_id) REFERENCES users(id), INDEX (post_id,status));
CREATE TABLE IF NOT EXISTS transactions (
  id CHAR(36) PRIMARY KEY, post_id CHAR(36) NOT NULL, offer_id CHAR(36) NOT NULL UNIQUE, requester_id CHAR(36) NOT NULL, traveler_id CHAR(36) NOT NULL,
  item_details VARCHAR(150) NOT NULL, quantity INT NOT NULL DEFAULT 1, agreed_price DECIMAL(10,2) NOT NULL,
  payment_status ENUM('unpaid','held','released','refunded') NOT NULL DEFAULT 'unpaid',  -- SIMULATED only
  delivery_status ENUM('not_started','in_transit','delivered','received') NOT NULL DEFAULT 'not_started',
  transaction_status ENUM('pending','approved','cancelled','paid','in_transit','delivered','completed','disputed') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id), FOREIGN KEY (offer_id) REFERENCES offers(id), FOREIGN KEY (requester_id) REFERENCES users(id), FOREIGN KEY (traveler_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS transaction_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, transaction_id CHAR(36) NOT NULL, status VARCHAR(20) NOT NULL, actor_id CHAR(36) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id));
CREATE TABLE IF NOT EXISTS messages (
  id CHAR(36) PRIMARY KEY, conversation_id VARCHAR(80) NOT NULL, sender_id CHAR(36) NOT NULL, receiver_id CHAR(36) NOT NULL, content VARCHAR(2000) NOT NULL,
  related_id CHAR(36) NULL, is_read TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (sender_id) REFERENCES users(id), FOREIGN KEY (receiver_id) REFERENCES users(id), INDEX (conversation_id,created_at), INDEX (receiver_id,is_read));
CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, type VARCHAR(40) NOT NULL, message VARCHAR(255) NOT NULL, related_id VARCHAR(80) NULL, link VARCHAR(100) NOT NULL DEFAULT '',
  is_read TINYINT(1) NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id), INDEX (user_id,is_read));
CREATE TABLE IF NOT EXISTS reviews (
  id CHAR(36) PRIMARY KEY, transaction_id CHAR(36) NOT NULL, reviewer_id CHAR(36) NOT NULL, reviewed_user_id CHAR(36) NOT NULL, rating TINYINT NOT NULL, comment VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY one_review_per_tx (transaction_id, reviewer_id), CHECK (rating BETWEEN 1 AND 5),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id), FOREIGN KEY (reviewer_id) REFERENCES users(id), FOREIGN KEY (reviewed_user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS reports (
  id CHAR(36) PRIMARY KEY, reporter_id CHAR(36) NOT NULL, target_id CHAR(36) NOT NULL, target_type ENUM('post','user','transaction') NOT NULL, reason VARCHAR(500) NOT NULL,
  status ENUM('open','resolved','dismissed') NOT NULL DEFAULT 'open', decision VARCHAR(500) NOT NULL DEFAULT '', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (reporter_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS admin_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, admin_id CHAR(36) NOT NULL, action VARCHAR(255) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (admin_id) REFERENCES users(id));
-- Identity verification. Photos exist only while a request is pending: approve/reject set both image columns to NULL.
-- Status shown to the user is derived: users.verified=1 -> 'verified', otherwise the latest request's status, otherwise 'unverified'.
CREATE TABLE IF NOT EXISTS verification_requests (
  id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, id_type VARCHAR(40) NOT NULL, name_on_id VARCHAR(100) NOT NULL,
  id_image MEDIUMTEXT NULL, selfie_image MEDIUMTEXT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending', reason VARCHAR(255) NOT NULL DEFAULT '',
  reviewed_by CHAR(36) NULL, reviewed_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (reviewed_by) REFERENCES users(id), INDEX (status,created_at), INDEX (user_id,created_at));
-- Payment HOLD ledger. SIMULATED: no gateway, no real money. One row per paid transaction.
-- held -> released (receipt confirmed / auto-release / admin) ; held -> disputed -> released | refunded (admin)
CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) PRIMARY KEY, transaction_id CHAR(36) NOT NULL UNIQUE, payer_id CHAR(36) NOT NULL, payee_id CHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL, method ENUM('GCash','Maya','Bank transfer') NOT NULL, reference VARCHAR(12) NOT NULL UNIQUE,
  status ENUM('held','disputed','released','refunded') NOT NULL DEFAULT 'held',
  held_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, auto_release_at DATETIME NULL, released_at DATETIME NULL, refunded_at DATETIME NULL,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id), FOREIGN KEY (payer_id) REFERENCES users(id), FOREIGN KEY (payee_id) REFERENCES users(id), INDEX (status,auto_release_at));
CREATE TABLE IF NOT EXISTS payment_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, payment_id CHAR(36) NOT NULL, type VARCHAR(20) NOT NULL, actor_id VARCHAR(36) NOT NULL, note VARCHAR(255) NOT NULL DEFAULT '', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id), INDEX (payment_id));
-- Likes ("reactions") and comments on posts. Replies are one level deep (parent_id points at a top-level comment).
CREATE TABLE IF NOT EXISTS comments (
  id CHAR(36) PRIMARY KEY, post_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL, parent_id CHAR(36) NULL, content VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id), FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE, INDEX (post_id,created_at));
CREATE TABLE IF NOT EXISTS reactions (
  id CHAR(36) PRIMARY KEY, target_type ENUM('post','comment') NOT NULL, target_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY one_like_each (target_type, target_id, user_id), FOREIGN KEY (user_id) REFERENCES users(id), INDEX (target_type,target_id));
